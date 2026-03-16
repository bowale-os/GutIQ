"""
Knowledge base ingestion pipeline — GutIQ Pain Relief RAG.

Industry-standard flow:
  1. Fetch raw documents   (PubMed API, NHS pages, local PDFs)
  2. Cache to Parquet      (avoid re-hitting APIs on every re-index)
  3. Load from Parquet
  4. Split into chunks     (RecursiveCharacterTextSplitter)
  5. Embed                 (sentence-transformers, local, free)
  6. Upsert to Qdrant Cloud (persistent, filterable by condition)

Usage:
  # First run — fetch everything fresh, build the index
  python -m app.rag.ingest

  # Re-index from cache (no API calls, iterate on chunking/embeddings fast)
  python -m app.rag.ingest --from-cache

  # Wipe and rebuild the collection from scratch
  python -m app.rag.ingest --recreate

Debug:
  Each step prints progress. If a step fails check:
    - PubMed: NCBI may be rate-limiting (increase DELAY_BETWEEN_QUERIES)
    - NHS: page structure may have changed (update WebBaseLoader selectors)
    - Qdrant: check QDRANT_URL and QDRANT_API_KEY in .env
    - Embeddings: first run downloads the model (~90MB), needs internet
"""

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Any

# Make sure app/ is importable when running as a script
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import pandas as pd
from dotenv import load_dotenv
from langchain_community.document_loaders import PyMuPDFLoader, WebBaseLoader
from langchain_community.document_loaders import PubMedLoader
from langchain_core.documents import Document
from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_qdrant import QdrantVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

load_dotenv()

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT       = Path(__file__).resolve().parents[2]   # backend/
CACHE_PATH = ROOT / "knowledge" / "cache" / "raw_docs.parquet"
PDF_DIR    = ROOT / "knowledge" / "pdfs"
TXT_DIR    = ROOT / "knowledge" / "txts"

# ── Qdrant config ──────────────────────────────────────────────────────────────
QDRANT_URL        = os.environ["QDRANT_URL"]
QDRANT_API_KEY    = os.environ["QDRANT_API_KEY"]
COLLECTION_NAME   = "gut_pain_relief"

# ── Embedding model ────────────────────────────────────────────────────────────
# all-MiniLM-L6-v2: lightweight, proven, 384-dim vectors
# Switch to "pritamdeka/S-PubMedBert-MS-MARCO" for richer medical embeddings
EMBEDDING_MODEL   = "BAAI/bge-small-en-v1.5"
VECTOR_SIZE       = 384   # must match embedding model output dim

# ── Chunking ───────────────────────────────────────────────────────────────────
CHUNK_SIZE        = 512
CHUNK_OVERLAP     = 64
INGEST_BATCH_SIZE = 100   # upsert to Qdrant in batches to avoid timeouts

# ── PubMed queries ─────────────────────────────────────────────────────────────
# (condition_key, search_query, max_docs)
# Only non-pharmacological, immediately-applicable interventions.
PUBMED_QUERIES: list[tuple[str, str, int]] = [
    ("ibs_cramping", "irritable bowel syndrome heat therapy abdominal pain relief", 20),
    ("ibs_cramping", "diaphragmatic breathing irritable bowel syndrome randomized controlled trial", 20),
    ("ibs_cramping", "peppermint oil irritable bowel syndrome systematic review", 15),
    ("ibs_cramping", "yoga IBS abdominal pain reduction randomized", 15),
    ("ibs_cramping", "IBS abdominal pain non-pharmacological self-management", 20),
    ("ibs_cramping", "progressive muscle relaxation irritable bowel syndrome", 15),
    ("gas_bloating", "abdominal bloating massage intervention randomized controlled trial", 20),
    ("gas_bloating", "intestinal gas body position relief flatulence", 15),
    ("gas_bloating", "peppermint oil bloating abdominal distension randomized", 15),
    ("gas_bloating", "walking exercise intestinal gas bloating symptom relief", 15),
    ("acid_reflux",  "GERD positional therapy left lateral decubitus randomized", 20),
    ("acid_reflux",  "gastroesophageal reflux chewing gum acid clearance randomized", 15),
    ("acid_reflux",  "heartburn posture position esophageal acid clearance", 15),
    ("acid_reflux",  "acid reflux lifestyle intervention immediate symptom relief", 20),
    ("acid_reflux",  "GERD head elevation sleep position randomized", 15),
    ("constipation", "constipation abdominal massage randomized controlled trial", 20),
    ("constipation", "defecation squatting posture toilet anorectal angle", 15),
    ("constipation", "warm water intake bowel movement constipation relief", 15),
    ("constipation", "functional constipation non-pharmacological physical intervention", 20),
    ("constipation", "abdominal massage bowel function systematic review", 15),
    ("nausea",       "pericardium 6 acupressure nausea systematic review meta-analysis", 20),
    ("nausea",       "ginger nausea vomiting randomized controlled trial", 20),
    ("nausea",       "slow breathing nausea vagal nerve autonomic", 15),
    ("nausea",       "nausea non-pharmacological self management cold compress", 15),
    ("general",      "abdominal pain self management non-pharmacological heat", 20),
    ("general",      "gut directed relaxation breathing techniques abdominal pain", 15),
    ("general",      "mindfulness based intervention functional gut pain reduction", 15),
]

# ── NHS pages ──────────────────────────────────────────────────────────────────
NHS_PAGES: list[tuple[str, str]] = [
    ("ibs_cramping", "https://www.nhs.uk/conditions/irritable-bowel-syndrome-ibs/self-help/"),
    ("ibs_cramping", "https://www.nhs.uk/conditions/irritable-bowel-syndrome-ibs/treatment/"),
    ("gas_bloating", "https://www.nhs.uk/conditions/bloating/"),
    ("acid_reflux",  "https://www.nhs.uk/conditions/heartburn-and-acid-reflux/"),
    ("constipation", "https://www.nhs.uk/conditions/constipation/"),
    ("nausea",       "https://www.nhs.uk/conditions/feeling-sick-nausea/"),
]

# Filename keyword -> condition (auto-tags PDFs dropped in knowledge/pdfs/)
PDF_CONDITION_MAP: list[tuple[list[str], str]] = [
    (["ibs", "irritable"],                    "ibs_cramping"),
    (["bloat", "gas", "flatulence"],          "gas_bloating"),
    (["gerd", "reflux", "heartburn", "acid"], "acid_reflux"),
    (["constipat"],                           "constipation"),
    (["nausea", "vomit"],                     "nausea"),
]


# ── Step 1: Fetch ──────────────────────────────────────────────────────────────

def _fetch_pubmed() -> list[dict[str, Any]]:
    print("\n[PubMed] Fetching abstracts...")
    seen: set[str] = set()
    records: list[dict[str, Any]] = []

    for condition, query, max_docs in PUBMED_QUERIES:
        print(f"  [{condition}] {query[:60]}...")
        try:
            docs = PubMedLoader(query=query, load_max_docs=max_docs).load()
            for doc in docs:
                uid = doc.metadata.get("uid", "")
                if uid in seen:
                    continue
                seen.add(uid)
                records.append({
                    "text":      str(doc.page_content),
                    "condition": condition,
                    "source":    "pubmed",
                    "title":     str(doc.metadata.get("Title", "") or ""),
                    "pmid":      str(uid),
                    "year":      str(doc.metadata.get("PublishedDate", "") or "")[:4],
                })
            time.sleep(0.4)  # NCBI rate limit: ~3 req/s unauthenticated
        except Exception as exc:
            print(f"    ✗ {exc}")

    print(f"  -> {len(records)} unique abstracts")
    return records


def _fetch_nhs() -> list[dict[str, Any]]:
    print("\n[NHS] Scraping pages...")
    records: list[dict[str, Any]] = []

    for condition, url in NHS_PAGES:
        print(f"  [{condition}] {url}")
        try:
            docs = WebBaseLoader(url).load()
            for doc in docs:
                text = doc.page_content.strip()
                if len(text) < 200:
                    continue
                records.append({
                    "text":      str(text),
                    "condition": str(condition),
                    "source":    "nhs",
                    "title":     f"NHS {condition.replace('_', ' ').title()}",
                    "pmid":      "",
                    "year":      "2024",
                })
                print(f"    ✓ {len(text):,} chars")
        except Exception as exc:
            print(f"    ✗ {exc}")

    print(f"  -> {len(records)} pages")
    return records


def _load_pdfs() -> list[dict[str, Any]]:
    print(f"\n[PDF] {PDF_DIR}")
    pdf_files = list(PDF_DIR.glob("*.pdf"))

    if not pdf_files:
        print("  No PDFs — drop ACG/BSG/Rome Foundation guidelines into knowledge/pdfs/")
        return []

    records: list[dict[str, Any]] = []
    for path in pdf_files:
        print(f"  {path.name}")
        try:
            docs     = PyMuPDFLoader(str(path)).load()
            text     = "\n\n".join(d.page_content for d in docs if d.page_content.strip())
            name     = path.stem.lower()
            condition = next(
                (cond for kws, cond in PDF_CONDITION_MAP if any(k in name for k in kws)),
                "general",
            )
            records.append({
                "text":      text,
                "condition": condition,
                "source":    "pdf",
                "title":     path.stem.replace("_", " ").title(),
                "pmid":      "",
                "year":      "",
            })
            print(f"    ✓ {len(text):,} chars -> {condition}")
        except Exception as exc:
            print(f"    ✗ {exc}")

    print(f"  -> {len(records)} PDFs")
    return records


def _load_txts() -> list[dict[str, Any]]:
    """Load plain-text clinical documents from knowledge/txts/."""
    print(f"\n[TXT] {TXT_DIR}")
    txt_files = list(TXT_DIR.glob("*.txt"))

    if not txt_files:
        print("  No .txt files found")
        return []

    records: list[dict[str, Any]] = []
    for path in txt_files:
        print(f"  {path.name}")
        try:
            text = path.read_text(encoding="utf-8", errors="ignore").strip()
            if not text:
                continue
            name      = path.stem.lower()
            condition = next(
                (cond for kws, cond in PDF_CONDITION_MAP if any(k in name for k in kws)),
                "general",
            )
            records.append({
                "text":      text,
                "condition": condition,
                "source":    "txt",
                "title":     path.stem.replace("_", " ").title(),
                "pmid":      "",
                "year":      "",
            })
            print(f"    -> {len(text):,} chars | condition: {condition}")
        except Exception as exc:
            print(f"    ✗ {exc}")

    print(f"  -> {len(records)} txt files")
    return records


# ── Step 2 & 3: Parquet cache ──────────────────────────────────────────────────

def _save_cache(records: list[dict[str, Any]]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(records)
    # Force all columns to str — PubMed metadata can return dicts/lists
    # which confuse pyarrow's type inference and cause ArrowTypeError
    for col in df.columns:
        df[col] = df[col].apply(lambda v: v.get("#text", str(v)) if isinstance(v, dict) else str(v) if v is not None else "")
    df.to_parquet(CACHE_PATH, index=False)
    print(f"\n[Cache] Saved {len(records)} records -> {CACHE_PATH}")


def _load_cache() -> list[dict[str, Any]]:
    if not CACHE_PATH.exists():
        raise FileNotFoundError(
            f"No cache at {CACHE_PATH}. Run without --from-cache first."
        )
    df = pd.read_parquet(CACHE_PATH)
    print(f"[Cache] Loaded {len(df)} records")
    return df.to_dict(orient="records")


# ── Step 4: Split ──────────────────────────────────────────────────────────────

def _split(records: list[dict[str, Any]]) -> list[Document]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " "],
    )
    chunks: list[Document] = []

    for rec in records:
        text = rec.get("text", "").strip()
        if not text:
            continue
        doc = Document(
            page_content=text,
            metadata={
                "condition": rec.get("condition", "general"),
                "source":    rec.get("source", "unknown"),
                "title":     rec.get("title", ""),
                "pmid":      rec.get("pmid", ""),
                "year":      rec.get("year", ""),
            },
        )
        chunks.extend(splitter.split_documents([doc]))

    print(f"\n[Splitter] {len(records)} docs -> {len(chunks)} chunks")
    return chunks


# ── Step 5 & 6: Embed + Upsert to Qdrant ──────────────────────────────────────

def _ensure_collection(client: QdrantClient, recreate: bool) -> None:
    """Create the Qdrant collection if it doesn't exist, or wipe and recreate."""
    exists = any(c.name == COLLECTION_NAME for c in client.get_collections().collections)

    if exists and recreate:
        print(f"[Qdrant] Deleting existing collection '{COLLECTION_NAME}'...")
        client.delete_collection(COLLECTION_NAME)
        exists = False

    if not exists:
        print(f"[Qdrant] Creating collection '{COLLECTION_NAME}' (dim={VECTOR_SIZE}, cosine)...")
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        # Payload index on condition — required for filtered similarity search
        # Without this Qdrant returns 400 on any filter query
        from qdrant_client.models import PayloadSchemaType
        client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="metadata.condition",
            field_schema=PayloadSchemaType.KEYWORD,
        )
        print(f"[Qdrant] Payload index created on 'metadata.condition'")


def _upsert_to_qdrant(chunks: list[Document], recreate: bool) -> None:
    print(f"\n[Embeddings] Loading {EMBEDDING_MODEL} via FastEmbed (no PyTorch)...")
    embeddings = FastEmbedEmbeddings(model_name=EMBEDDING_MODEL)

    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    _ensure_collection(client, recreate=recreate)

    print(f"[Qdrant] Upserting {len(chunks)} chunks in batches of {INGEST_BATCH_SIZE}...")
    total_batches = (len(chunks) - 1) // INGEST_BATCH_SIZE + 1

    for i in range(0, len(chunks), INGEST_BATCH_SIZE):
        batch    = chunks[i : i + INGEST_BATCH_SIZE]
        batch_no = i // INGEST_BATCH_SIZE + 1
        print(f"  batch {batch_no}/{total_batches} ({len(batch)} chunks)")

        QdrantVectorStore.from_documents(
            documents=batch,
            embedding=embeddings,
            url=QDRANT_URL,
            api_key=QDRANT_API_KEY,
            collection_name=COLLECTION_NAME,
            force_recreate=False,   # collection already created above
        )

    count = client.count(COLLECTION_NAME).count
    print(f"\n[Qdrant] Collection '{COLLECTION_NAME}' now has {count} vectors")


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="GutIQ knowledge base ingestion")
    parser.add_argument(
        "--from-cache",
        action="store_true",
        help="Skip fetching — load from Parquet cache and re-index",
    )
    parser.add_argument(
        "--recreate",
        action="store_true",
        help="Wipe and recreate the Qdrant collection before upserting",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("GutIQ Pain Relief — Knowledge Base Ingestion")
    print("=" * 60)
    print(f"  Qdrant : {QDRANT_URL}")
    print(f"  Collection: {COLLECTION_NAME}")
    print(f"  Embeddings: {EMBEDDING_MODEL}")

    if args.from_cache:
        # Reload PubMed/NHS from Parquet — skip API calls
        # Always reload local files fresh so new PDFs/txts are picked up
        cached  = _load_cache()
        pdfs    = _load_pdfs()
        txts    = _load_txts()
        records = cached + pdfs + txts
    else:
        pubmed  = _fetch_pubmed()
        nhs     = _fetch_nhs()
        pdfs    = _load_pdfs()
        txts    = _load_txts()
        records = pubmed + nhs + pdfs + txts
        print(f"\nTotal raw documents: {len(records)}")
        _save_cache(records)

    chunks = _split(records)
    _upsert_to_qdrant(chunks, recreate=args.recreate)

    conditions = {r.get("condition", "general") for r in records}
    print(f"\n✓ Done. {len(chunks)} chunks | {len(conditions)} conditions | Qdrant Cloud")


if __name__ == "__main__":
    main()
