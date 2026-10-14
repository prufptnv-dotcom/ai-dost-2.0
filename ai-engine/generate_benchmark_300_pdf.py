import os
import sys
import json
import re
import html
import statistics
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# Font registration
FONT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend', 'fonts'))
NOTO_REGULAR = os.path.join(FONT_DIR, 'NotoSansDevanagari-Regular.ttf')
NOTO_BOLD = os.path.join(FONT_DIR, 'NotoSansDevanagari-Bold.ttf')

DEFAULT_FONT = 'Helvetica'
DEFAULT_BOLD = 'Helvetica-Bold'
HINDI_FONT = 'Helvetica'
HINDI_BOLD = 'Helvetica-Bold'

if os.path.exists(NOTO_REGULAR) and os.path.exists(NOTO_BOLD):
    try:
        pdfmetrics.registerFont(TTFont('NotoDevanagari', NOTO_REGULAR))
        pdfmetrics.registerFont(TTFont('NotoDevanagari-Bold', NOTO_BOLD))
        HINDI_FONT = 'NotoDevanagari'
        HINDI_BOLD = 'NotoDevanagari-Bold'
        print("[OK] Registered NotoSansDevanagari fonts")
    except Exception as e:
        print(f"[WARN] Font register warning: {e}")

def has_devanagari(text):
    return bool(re.search(r'[\u0900-\u097F]', text or ''))

def clean_for_xml(text):
    if not text:
        return ""
    # Remove control characters except tab, newline
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', text)
    # Convert html entities
    text = html.escape(text)
    # Convert double newlines to breaks
    text = text.replace('\n', '<br/>')
    return text

def format_status_for(record):
    """Map historical statuses to response-format status, never task correctness."""
    if not record.get("success"):
        return "NOT_EVALUATED"
    status = record.get("format_status")
    if status in {"FORMAT_PASS", "FORMAT_FAIL"}:
        return status
    # Older saved results came from the former format heuristic.
    if record.get("pass_fail") == "PASS":
        return "FORMAT_PASS"
    if record.get("pass_fail") == "FAIL":
        return "FORMAT_FAIL"
    return "NOT_EVALUATED"


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#666666"))

        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "AI Dost: Response-Format Heuristic Report")
            self.drawRightString(558, 750, "AI Dost / developer-generated")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(54, 744, 558, 744)

        # Footer
        footer_text = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(558, 36, footer_text)
        self.drawString(54, 36, "Developer-generated heuristic report — not an accuracy benchmark")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 46, 558, 46)

        self.restoreState()

def build_pdf(results_file, output_pdf_path):
    print(f"Loading results from {results_file}...")
    with open(results_file, 'r', encoding='utf-8') as f:
        results = json.load(f)

    os.makedirs(os.path.dirname(output_pdf_path), exist_ok=True)
    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Title'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=colors.HexColor('#0F172A'),
        alignment=0,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#475569'),
        spaceAfter=15
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#1E293B'),
        spaceBefore=14,
        spaceAfter=8
    )

    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#2563EB'),
        spaceBefore=10,
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12.5,
        textColor=colors.HexColor('#334155')
    )

    body_hindi_style = ParagraphStyle(
        'BodyHindi',
        parent=styles['Normal'],
        fontName=HINDI_FONT,
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155')
    )

    prompt_style = ParagraphStyle(
        'Prompt',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12.5,
        textColor=colors.HexColor('#0F172A')
    )

    prompt_hindi_style = ParagraphStyle(
        'PromptHindi',
        parent=styles['Normal'],
        fontName=HINDI_BOLD,
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#0F172A')
    )

    meta_pill_style = ParagraphStyle(
        'MetaPill',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor('#64748B')
    )

    story = []

    # ── Cover Header ──
    story.append(Paragraph("AI Dost: Response-Format Heuristic Report", title_style))
    story.append(Paragraph("Historical 300-prompt run | Format-only scores — not an accuracy benchmark", subtitle_style))
    story.append(Paragraph("<b>Validity warning:</b> The score checks response shape only. It does not establish truth, code correctness, or task completion; prompts are repository-stored rather than a blind holdout.", body_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#2563EB'), spaceAfter=15))

    # ── Page 14 Summary Sheet ──
    total_q = len(results)
    successful = [r for r in results if r.get("success")]
    completed = len(successful)
    failed = total_q - completed
    latencies = [r["latency_s"] for r in successful]
    avg_latency = round(statistics.mean(latencies), 2) if latencies else 0
    median_latency = round(statistics.median(latencies), 2) if latencies else 0
    total_tokens = sum(int(r.get("estimated_tokens", r.get("generated_tokens", 0)) or 0) for r in successful)
    total_time = sum(latencies)
    avg_tps = round(total_tokens / total_time, 1) if total_time > 0 else 0
    overall_score = round(sum(r["score"] for r in successful) / len(successful), 2) if successful else 0
    format_evaluated = [r for r in successful if format_status_for(r) in {"FORMAT_PASS", "FORMAT_FAIL"}]
    pass_count = sum(1 for r in format_evaluated if format_status_for(r) == "FORMAT_PASS")
    pass_rate = round((pass_count / len(format_evaluated)) * 100, 1) if format_evaluated else None
    pass_rate_label = f"{pass_rate}% ({pass_count}/{len(format_evaluated)})" if pass_rate is not None else "N/A (no responses evaluated)"

    model_label = html.escape(os.getenv("AI_DOST_BENCHMARK_MODEL", "Not recorded"))
    checkpoint_label = html.escape(os.getenv("AI_DOST_BENCHMARK_CHECKPOINT", "Not recorded"))
    training_label = html.escape(os.getenv("AI_DOST_BENCHMARK_TRAINING", "Not recorded"))
    hardware_label = html.escape(os.getenv("AI_DOST_BENCHMARK_HARDWARE", "Not recorded; not measured by this script"))
    precision_label = html.escape(os.getenv("AI_DOST_BENCHMARK_PRECISION", "Not recorded"))
    peak_vram_label = html.escape(os.getenv("AI_DOST_BENCHMARK_PEAK_VRAM", "Not measured by this script"))
    completion_rate = (completed / total_q * 100) if total_q else 0

    story.append(Paragraph("1. Run summary (response-format heuristics only)", h1_style))

    summary_data = [
        [Paragraph("<b>Metric</b>", body_style), Paragraph("<b>Value</b>", body_style)],
        [Paragraph("Model identifier", body_style), Paragraph(model_label, body_style)],
        [Paragraph("Checkpoint / snapshot", body_style), Paragraph(checkpoint_label, body_style)],
        [Paragraph("Reported base model / training", body_style), Paragraph(training_label, body_style)],
        [Paragraph("Hardware", body_style), Paragraph(hardware_label, body_style)],
        [Paragraph("Precision / quantization", body_style), Paragraph(precision_label, body_style)],
        [Paragraph("Prompts in results", body_style), Paragraph(f"<b>{total_q}</b> (not a blind holdout)", body_style)],
        [Paragraph("Responses received", body_style), Paragraph(f"<b>{completed} ({completion_rate:.1f}%)</b>", body_style)],
        [Paragraph("Request failures / timeouts", body_style), Paragraph(f"<b>{failed}</b>", body_style)],
        [Paragraph("Average response latency", body_style), Paragraph(f"{avg_latency} seconds", body_style)],
        [Paragraph("Median response latency", body_style), Paragraph(f"<b>{median_latency} seconds</b>", body_style)],
        [Paragraph("Estimated response token rate", body_style), Paragraph(f"~{avg_tps} char-estimated tok/s; not provider telemetry", body_style)],
        [Paragraph("Peak VRAM", body_style), Paragraph(peak_vram_label, body_style)],
        [Paragraph("Mean heuristic format score", body_style), Paragraph(f"<b>{overall_score} / 10 (not accuracy)</b>", body_style)],
        [Paragraph("Format-threshold rate", body_style), Paragraph(f"<b>{pass_rate_label} (not correctness)</b>", body_style)],
        [Paragraph("Evaluation limitations", body_style), Paragraph("Shallow response-format checks only; no independent truth grading or generated-code execution.", body_style)],
    ]

    t_summary = Table(summary_data, colWidths=[200, 304])
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (1, 0), colors.HexColor('#F1F5F9')),
        ('TEXTCOLOR', (0, 0), (1, 0), colors.HexColor('#0F172A')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')])
    ]))
    story.append(t_summary)
    story.append(Spacer(1, 15))

    # ── Category Breakdown Table ──
    story.append(Paragraph("2. Category-wise format-check summary", h1_style))

    cat_table_data = [
        [
            Paragraph("<b>Category</b>", body_style),
            Paragraph("<b>Responses</b>", body_style),
            Paragraph("<b>Format rate*</b>", body_style),
            Paragraph("<b>Heuristic score</b>", body_style),
            Paragraph("<b>Median Lat</b>", body_style),
            Paragraph("<b>Avg Tokens</b>", body_style)
        ]
    ]

    cats = {}
    for r in results:
        c = r["cat"]
        if c not in cats:
            cats[c] = []
        cats[c].append(r)

    for c_name, items in cats.items():
        s_items = [x for x in items if x.get("success")]
        format_items = [x for x in s_items if format_status_for(x) in {"FORMAT_PASS", "FORMAT_FAIL"}]
        p_cnt = sum(1 for x in format_items if format_status_for(x) == "FORMAT_PASS")
        p_rate = f"{(p_cnt / len(format_items)) * 100:.1f}%" if format_items else "N/A"
        avg_sc = f"{sum(x['score'] for x in s_items) / len(s_items):.2f}" if s_items else "N/A"
        med_lat = f"{statistics.median([x['latency_s'] for x in s_items]):.1f}s" if s_items else "N/A"
        token_values = [int(x.get("estimated_tokens", x.get("generated_tokens", 0)) or 0) for x in s_items]
        avg_tok = f"{int(statistics.mean(token_values))}" if token_values else "N/A"

        cat_table_data.append([
            Paragraph(c_name, body_style),
            Paragraph(f"{len(s_items)}/{len(items)}", body_style),
            Paragraph(f"<b>{p_rate}</b>", body_style),
            Paragraph(f"<b>{avg_sc}/10</b>", body_style),
            Paragraph(med_lat, body_style),
            Paragraph(avg_tok, body_style)
        ])

    t_cats = Table(cat_table_data, colWidths=[200, 50, 64, 60, 65, 65])
    t_cats.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')])
    ]))
    story.append(t_cats)
    story.append(PageBreak())

    # ── Detailed Question & Answer Section (All 300 Questions) ──
    story.append(Paragraph("3. Prompt-by-prompt answers (not independently correctness-graded)", h1_style))
    story.append(Paragraph("Responses loaded from the selected results file. This report does not independently check factual correctness or execute generated code; hardware telemetry is not collected by this script.", subtitle_style))

    current_cat = None

    for item in results:
        qid = item["qid"]
        cat = item["cat"]
        diff = item["diff"]
        prompt = item["prompt"]
        answer = item["model_answer"]
        score = item["score"]
        pf = format_status_for(item)
        lat = item.get("latency_s", 0)
        tok = item.get("estimated_tokens", item.get("generated_tokens", 0))
        tps = item.get("estimated_tokens_per_sec", item.get("tokens_per_sec", 0))
        note = item["evaluator_note"]

        if cat != current_cat:
            current_cat = cat
            story.append(Spacer(1, 10))
            story.append(Paragraph(f"Category: {cat}", h1_style))
            story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CBD5E1'), spaceAfter=8))

        is_hindi = has_devanagari(prompt) or has_devanagari(answer)
        p_style = prompt_hindi_style if is_hindi else prompt_style
        ans_style = body_hindi_style if is_hindi else body_style

        # Question Card Header
        q_elements = []
        badge_color = "#16A34A" if pf == "FORMAT_PASS" else "#DC2626" if pf == "FORMAT_FAIL" else "#64748B"
        header_text = (
            f"<b>{qid}</b> [{diff}] &nbsp;|&nbsp; "
            f"<b><font color='{badge_color}'>{pf} (heuristic {score}/10)</font></b> &nbsp;|&nbsp; "
            f"Latency: {lat}s &nbsp;|&nbsp; Estimated tokens: {tok} (~{tps} tok/s)"
        )
        q_elements.append(Paragraph(header_text, h2_style))

        # Prompt Box
        clean_prompt = clean_for_xml(prompt)
        q_elements.append(Paragraph(f"<b>Prompt:</b> {clean_prompt}", p_style))
        q_elements.append(Spacer(1, 4))

        # Answer Box
        # Limit very long answers for formatting sanity in report
        clean_ans = clean_for_xml(answer)
        q_elements.append(Paragraph(f"<b>Model response:</b><br/>{clean_ans}", ans_style))
        q_elements.append(Spacer(1, 3))

        # Evaluator Note
        clean_note = clean_for_xml(note)
        q_elements.append(Paragraph(f"<i>Evaluator Note: {clean_note}</i>", meta_pill_style))
        q_elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#E2E8F0'), spaceBefore=6, spaceAfter=8))

        story.append(KeepTogether(q_elements))

    print(f"Compiling document into {output_pdf_path} (this may take a few seconds)...")
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated PDF: {output_pdf_path} ({os.path.getsize(output_pdf_path)/(1024*1024):.2f} MB)")

if __name__ == "__main__":
    results_json = "benchmark_300_results.json"
    dest_pdf = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "downloads", "AI_Dost_300_Response_Format_Heuristic_Report.pdf"))
    build_pdf(results_json, dest_pdf)
