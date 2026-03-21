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
CACHE_PATH            = ROOT / "knowledge" / "cache" / "raw_docs.parquet"
PUBMED_CHECKPOINT_PATH = ROOT / "knowledge" / "cache" / "pubmed_checkpoint.parquet"
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
# Focused on non-pharmacological self-management, lifestyle, and immediate relief.
PUBMED_QUERIES: list[tuple[str, str, int]] = [
    # ── IBS ────────────────────────────────────────────────────────────────────
    ("ibs_cramping", "irritable bowel syndrome abdominal pain heat therapy randomized", 20),
    ("ibs_cramping", "diaphragmatic breathing irritable bowel syndrome randomized controlled trial", 20),
    ("ibs_cramping", "peppermint oil irritable bowel syndrome systematic review meta-analysis", 20),
    ("ibs_cramping", "yoga IBS symptom reduction randomized controlled trial", 15),
    ("ibs_cramping", "cognitive behavioural therapy irritable bowel syndrome abdominal pain", 20),
    ("ibs_cramping", "low FODMAP diet irritable bowel syndrome symptom relief", 20),
    ("ibs_cramping", "gut directed hypnotherapy irritable bowel syndrome randomized", 15),
    ("ibs_cramping", "IBS-D IBS-C mixed irritable bowel syndrome self-management lifestyle", 20),

    # ── Gas / Bloating ─────────────────────────────────────────────────────────
    ("gas_bloating", "abdominal bloating massage intervention randomized controlled trial", 20),
    ("gas_bloating", "intestinal gas body position flatulence relief systematic review", 15),
    ("gas_bloating", "peppermint oil abdominal distension bloating randomized", 15),
    ("gas_bloating", "walking exercise intestinal gas bloating symptom reduction", 15),
    ("gas_bloating", "simethicone activated charcoal intestinal gas randomized", 15),
    ("gas_bloating", "low FODMAP diet bloating abdominal distension clinical trial", 20),
    ("gas_bloating", "probiotic Lactobacillus Bifidobacterium abdominal bloating flatulence randomized", 20),
    ("gas_bloating", "probiotic supplementation intestinal gas bloating meta-analysis systematic review", 20),
    ("gas_bloating", "alpha-galactosidase enzyme legume gas flatulence randomized controlled", 15),
    ("gas_bloating", "functional bloating Rome criteria dietary intervention clinical trial", 15),
    ("gas_bloating", "SIBO small intestinal bacterial overgrowth bloating treatment response", 15),
    ("gas_bloating", "diaphragm pelvic floor abdominal distension postural biofeedback", 15),
    ("gas_bloating", "digestive enzyme supplement bloating postprandial distension randomized", 15),
    ("gas_bloating", "exclusion diet food intolerance abdominal bloating gas elimination", 15),

    # ── GERD / Acid Reflux ─────────────────────────────────────────────────────
    ("acid_reflux",  "GERD left lateral decubitus positional therapy randomized controlled", 20),
    ("acid_reflux",  "gastroesophageal reflux chewing gum saliva acid clearance randomized", 15),
    ("acid_reflux",  "GERD head of bed elevation nocturnal symptoms randomized", 15),
    ("acid_reflux",  "acid reflux weight loss lifestyle intervention systematic review", 20),
    ("acid_reflux",  "GERD dietary trigger food avoidance systematic review", 20),
    ("acid_reflux",  "coffee alcohol smoking GERD symptom randomized observational", 15),
    ("acid_reflux",  "GERD meal timing portion size postprandial symptoms", 15),
    ("acid_reflux",  "gastroesophageal reflux disease lifestyle modification systematic review meta-analysis", 20),
    ("acid_reflux",  "GERD obesity body mass index weight reduction symptom improvement randomized", 20),
    ("acid_reflux",  "laryngopharyngeal reflux dietary management lifestyle modification clinical", 15),
    ("acid_reflux",  "acid reflux chocolate fat dietary elimination trigger symptom randomized", 15),
    ("acid_reflux",  "GERD nocturnal heartburn sleep position wedge pillow randomized", 15),
    ("acid_reflux",  "acid reflux stress anxiety psychological intervention symptom systematic review", 15),
    ("acid_reflux",  "GERD Mediterranean diet anti-inflammatory eating pattern observational", 15),

    # ── Constipation ──────────────────────────────────────────────────────────
    ("constipation", "abdominal massage chronic constipation bowel movement randomized", 20),
    ("constipation", "squatting posture defecation anorectal angle stool passage", 15),
    ("constipation", "warm water intake bowel movement constipation relief randomized", 15),
    ("constipation", "physical activity exercise chronic constipation systematic review", 20),
    ("constipation", "dietary fibre soluble insoluble constipation bowel frequency", 20),
    ("constipation", "biofeedback pelvic floor dysfunction constipation randomized", 15),

    # ── Nausea ────────────────────────────────────────────────────────────────
    ("nausea",       "pericardium 6 acupressure PC6 nausea meta-analysis systematic review", 20),
    ("nausea",       "ginger nausea vomiting randomized controlled trial systematic review", 20),
    ("nausea",       "slow diaphragmatic breathing nausea autonomic vagal", 15),
    ("nausea",       "cold compress wrist nausea non-pharmacological relief", 10),
    ("nausea",       "dietary modification nausea gastroparesis delayed gastric emptying", 20),

    # ── Functional Dyspepsia ──────────────────────────────────────────────────
    ("functional_dyspepsia", "functional dyspepsia dietary intervention systematic review", 20),
    ("functional_dyspepsia", "functional dyspepsia low acid diet symptom relief randomized", 15),
    ("functional_dyspepsia", "postprandial distress epigastric pain syndrome lifestyle management", 20),
    ("functional_dyspepsia", "functional dyspepsia mindfulness stress reduction randomized", 15),
    ("functional_dyspepsia", "dyspepsia meal size fat content symptom trigger", 20),
    ("functional_dyspepsia", "peppermint caraway oil functional dyspepsia randomized", 15),
    ("functional_dyspepsia", "cognitive behavioural therapy functional dyspepsia RCT", 15),

    # ── IBD — Crohn's + Ulcerative Colitis ────────────────────────────────────
    ("ibd_flare",    "Crohn's disease remission dietary management nutritional therapy", 20),
    ("ibd_flare",    "ulcerative colitis flare dietary modification symptom management", 20),
    ("ibd_flare",    "inflammatory bowel disease stress psychological intervention RCT", 15),
    ("ibd_flare",    "IBD fatigue exercise physical activity randomized controlled", 15),
    ("ibd_flare",    "Crohn's ulcerative colitis low residue diet acute flare management", 20),
    ("ibd_flare",    "inflammatory bowel disease gut microbiome dietary intervention", 20),
    ("ibd_flare",    "IBD abdominal pain heat therapy non-pharmacological relief", 15),

    # ── Lactose Intolerance ───────────────────────────────────────────────────
    ("lactose_intolerance", "lactose intolerance dietary management symptom reduction review", 20),
    ("lactose_intolerance", "lactase enzyme supplementation lactose intolerance randomized", 20),
    ("lactose_intolerance", "lactose threshold dose response symptoms randomized", 15),
    ("lactose_intolerance", "dairy-free diet lactose intolerance bloating diarrhea", 15),
    ("lactose_intolerance", "fermented dairy yogurt kefir lactose intolerance tolerance", 20),
    ("lactose_intolerance", "lactose intolerance IBS overlap differential diagnosis", 15),
    ("lactose_intolerance", "probiotic bacteria lactase production lactose fermentation tolerance improvement", 20),
    ("lactose_intolerance", "lactose intolerance calcium bone health dairy alternative supplementation", 15),
    ("lactose_intolerance", "hypolactasia lactase non-persistence primary secondary management clinical", 15),
    ("lactose_intolerance", "lactose malabsorption breath test hydrogen symptom correlation", 15),
    ("lactose_intolerance", "lactose intolerance milk chocolate hard cheese tolerance threshold", 15),
    ("lactose_intolerance", "lactose intolerance gut microbiome adaptation colonic fermentation", 15),

    # ── Peptic Ulcer / H. pylori ──────────────────────────────────────────────
    ("peptic_ulcer",  "peptic ulcer disease non-pharmacological dietary lifestyle management", 20),
    ("peptic_ulcer",  "H pylori infection dietary factors lifestyle symptom management", 20),
    ("peptic_ulcer",  "peptic ulcer NSAID avoidance alcohol smoking risk reduction", 15),
    ("peptic_ulcer",  "gastric ulcer meal timing dietary modification pain relief", 15),
    ("peptic_ulcer",  "Helicobacter pylori probiotics symptom randomized controlled trial", 20),

    # ── Celiac Disease ────────────────────────────────────────────────────────
    ("celiac",        "coeliac disease gluten free diet adherence symptom remission", 20),
    ("celiac",        "celiac disease gluten contamination cross contamination management", 15),
    ("celiac",        "gluten free diet quality of life celiac disease randomized", 20),
    ("celiac",        "celiac disease refractory symptoms persistent despite gluten free", 15),
    ("celiac",        "coeliac abdominal pain bloating dietary management systematic review", 20),

    # ── General gut health ────────────────────────────────────────────────────
    ("general",       "gut microbiome dietary patterns abdominal symptoms systematic review", 20),
    ("general",       "mindfulness based stress reduction functional GI disorders randomized", 15),
    ("general",       "Mediterranean diet gut health inflammation systematic review", 15),
    ("general",       "abdominal pain self management non-pharmacological heat relaxation", 20),
]

# ── NHS pages ──────────────────────────────────────────────────────────────────
NHS_PAGES: list[tuple[str, str]] = [
    ("ibs_cramping",         "https://www.nhs.uk/conditions/irritable-bowel-syndrome-ibs/self-help/"),
    ("ibs_cramping",         "https://www.nhs.uk/conditions/irritable-bowel-syndrome-ibs/treatment/"),
    ("gas_bloating",         "https://www.nhs.uk/conditions/bloating/"),
    ("acid_reflux",          "https://www.nhs.uk/conditions/heartburn-and-acid-reflux/"),
    ("constipation",         "https://www.nhs.uk/conditions/constipation/"),
    ("nausea",               "https://www.nhs.uk/conditions/feeling-sick-nausea/"),
    ("functional_dyspepsia", "https://www.nhs.uk/conditions/indigestion/"),
    ("ibd_flare",            "https://www.nhs.uk/conditions/crohns-disease/living-with/"),
    ("ibd_flare",            "https://www.nhs.uk/conditions/ulcerative-colitis/living-with/"),
    ("celiac",               "https://www.nhs.uk/conditions/coeliac-disease/living-with/"),
    ("lactose_intolerance",  "https://www.nhs.uk/conditions/lactose-intolerance/"),
    ("peptic_ulcer",         "https://www.nhs.uk/conditions/stomach-ulcer/"),
]

# ── Subfolder name → condition key ────────────────────────────────────────────
# PDF subfolders are named by condition — use the parent folder to tag the chunk.
PDF_FOLDER_MAP: dict[str, str] = {
    "IBS":                  "ibs_cramping",
    "GERD":                 "acid_reflux",
    "Functional-Dyspepsia": "functional_dyspepsia",
    "H.pylori":             "peptic_ulcer",
    "Crohns":               "ibd_flare",
    "UC":                   "ibd_flare",
    "IBD":                  "ibd_flare",
    "Celiac":               "celiac",
    "Coeliac":              "celiac",
    "Constipation":         "constipation",
    "Lactose":              "lactose_intolerance",
    "Nausea":               "nausea",
    "Gastroparesis":        "nausea",
    "Gas-Bloating":         "gas_bloating",
    "Peptic-Ulcer":         "peptic_ulcer",
}

# Fallback: filename keywords (for PDFs sitting directly in pdfs/ root)
PDF_CONDITION_MAP: list[tuple[list[str], str]] = [
    (["ibs", "irritable"],                           "ibs_cramping"),
    (["bloat", "gas", "flatulence"],                 "gas_bloating"),
    (["gerd", "reflux", "heartburn", "acid"],        "acid_reflux"),
    (["constipat"],                                   "constipation"),
    (["nausea", "vomit", "gastroparesis"],           "nausea"),
    (["dyspepsia", "dyspep", "indigestion"],         "functional_dyspepsia"),
    (["crohn", "ulcerative", "colitis", "ibd"],      "ibd_flare"),
    (["celiac", "coeliac", "gluten"],                "celiac"),
    (["lactose", "dairy"],                           "lactose_intolerance"),
    (["pylori", "helicobacter", "peptic", "ulcer"],  "peptic_ulcer"),
]


# ── Step 1: Fetch ──────────────────────────────────────────────────────────────

def _fetch_pubmed() -> list[dict[str, Any]]:
    print("\n[PubMed] Fetching abstracts...")
    seen: set[str] = set()
    records: list[dict[str, Any]] = []

    # Resume from dedicated PubMed checkpoint — skip already-seen PMIDs.
    # Uses PUBMED_CHECKPOINT_PATH (not CACHE_PATH) so mid-run saves never
    # overwrite the full-corpus cache that --from-cache depends on.
    if PUBMED_CHECKPOINT_PATH.exists():
        try:
            cached_df = pd.read_parquet(PUBMED_CHECKPOINT_PATH)
            cached    = cached_df.to_dict(orient="records")
            for r in cached:
                pmid = str(r.get("pmid", ""))
                if pmid and pmid not in seen:
                    seen.add(pmid)
                    records.append(r)
            print(f"  [checkpoint] Loaded {len(records)} previously fetched abstracts — skipping duplicates")
        except Exception:
            pass  # corrupt or missing checkpoint — start fresh

    for i, (condition, query, max_docs) in enumerate(PUBMED_QUERIES):
        print(f"  [{condition}] {query[:60]}...", end=" ", flush=True)
        try:
            docs     = PubMedLoader(query=query, load_max_docs=max_docs).load()
            new_docs = 0
            for doc in docs:
                uid = doc.metadata.get("uid", "")
                if uid in seen:
                    continue
                seen.add(uid)
                new_docs += 1
                records.append({
                    "text":      str(doc.page_content),
                    "condition": condition,
                    "source":    "pubmed",
                    "title":     str(doc.metadata.get("Title", "") or ""),
                    "pmid":      str(uid),
                    "year":      str(doc.metadata.get("PublishedDate", "") or "")[:4],
                })
            print(f"{new_docs} new")
            time.sleep(0.4)  # NCBI rate limit: ~3 req/s unauthenticated
        except Exception as exc:
            print(f"✗ {exc}")

        # Save PubMed-only checkpoint every 10 queries so a crashed run can resume.
        # Writes to PUBMED_CHECKPOINT_PATH — never touches the full-corpus CACHE_PATH.
        if (i + 1) % 10 == 0:
            _save_pubmed_checkpoint(records)
            print(f"  [checkpoint] Saved {len(records)} records after query {i + 1}/{len(PUBMED_QUERIES)}")

    print(f"  -> {len(records)} unique abstracts total")
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
    # Walk all subfolders — organised as knowledge/pdfs/<Condition>/<file>.pdf
    pdf_files = list(PDF_DIR.glob("**/*.pdf"))

    if not pdf_files:
        print("  No PDFs — drop ACG/BSG/Rome Foundation guidelines into knowledge/pdfs/<Condition>/")
        return []

    records: list[dict[str, Any]] = []
    for path in pdf_files:
        print(f"  {path.parent.name}/{path.name}")
        try:
            docs = PyMuPDFLoader(str(path)).load()
            text = "\n\n".join(d.page_content for d in docs if d.page_content.strip())

            # 1. Try to resolve condition from subfolder name
            folder_name = path.parent.name
            condition   = PDF_FOLDER_MAP.get(folder_name)

            # 2. Fall back to filename keyword scan
            if condition is None:
                name      = path.stem.lower()
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

def _save_pubmed_checkpoint(records: list[dict[str, Any]]) -> None:
    """Write PubMed-only mid-run checkpoint. Never touches CACHE_PATH."""
    PUBMED_CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(records)
    for col in df.columns:
        df[col] = df[col].apply(lambda v: v.get("#text", str(v)) if isinstance(v, dict) else str(v) if v is not None else "")
    df.to_parquet(PUBMED_CHECKPOINT_PATH, index=False)


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

def _count_pubmed() -> None:
    """Dry-run: fetch PubMed abstracts and print counts per condition without indexing."""
    from collections import defaultdict
    print("\n[PubMed Count] Fetching abstracts (no indexing)...")
    counts: dict[str, int] = defaultdict(int)
    seen: set[str] = set()

    for condition, query, max_docs in PUBMED_QUERIES:
        print(f"  [{condition}] {query[:65]}...", end=" ", flush=True)
        try:
            docs = PubMedLoader(query=query, load_max_docs=max_docs).load()
            new  = [d for d in docs if d.metadata.get("uid", "") not in seen]
            for d in new:
                seen.add(d.metadata.get("uid", ""))
            counts[condition] += len(new)
            print(f"{len(new)} new abstracts")
            time.sleep(0.4)
        except Exception as exc:
            print(f"✗ {exc}")

    print("\n" + "=" * 50)
    print("Abstracts per condition (unique, deduplicated):")
    print("=" * 50)
    for cond, n in sorted(counts.items(), key=lambda x: -x[1]):
        bar = "█" * (n // 3)
        print(f"  {cond:<25}  {n:>3}  {bar}")
    print(f"\n  Total unique abstracts: {sum(counts.values())}")


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
    parser.add_argument(
        "--count-only",
        action="store_true",
        help="Dry-run: fetch PubMed and print article counts per condition, then exit",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("GutIQ Pain Relief — Knowledge Base Ingestion")
    print("=" * 60)
    print(f"  Qdrant : {QDRANT_URL}")
    print(f"  Collection: {COLLECTION_NAME}")
    print(f"  Embeddings: {EMBEDDING_MODEL}")

    if args.count_only:
        _count_pubmed()
        return

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
