import sys
import json
import os
import re
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Font setup: Noto Sans Devanagari (bundled, cross-platform)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(BASE_DIR, '..', 'fonts')
NOTO_REGULAR = os.path.join(FONT_DIR, 'NotoSansDevanagari-Regular.ttf')
NOTO_BOLD = os.path.join(FONT_DIR, 'NotoSansDevanagari-Bold.ttf')

# Register Noto fonts at module load
_DEFAULT_FONT = 'Helvetica'
_DEFAULT_BOLD = 'Helvetica-Bold'
if os.path.exists(NOTO_REGULAR) and os.path.exists(NOTO_BOLD):
    try:
        pdfmetrics.registerFont(TTFont('NotoDevanagari', NOTO_REGULAR))
        pdfmetrics.registerFont(TTFont('NotoDevanagari-Bold', NOTO_BOLD))
        _DEFAULT_FONT = 'NotoDevanagari'
        _DEFAULT_BOLD = 'NotoDevanagari-Bold'
        print("[OK] Noto Sans Devanagari fonts registered")
    except Exception as e:
        print(f"[WARN] Font register warning: {e}")

def _has_devanagari(text):
    """Check if text contains Devanagari characters."""
    return bool(re.search(r'[\u0900-\u097F]', text))

def _get_font_for_text(text):
    """Return appropriate font name based on text content."""
    return _DEFAULT_FONT if _has_devanagari(text) else 'Helvetica'

def _get_bold_font_for_text(text):
    """Return appropriate bold font name based on text content."""
    return _DEFAULT_BOLD if _has_devanagari(text) else 'Helvetica-Bold'

def generate_pdf(json_path, output_pdf_path):
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        title = data.get("title", "Research Document")
        content = data.get("content", "")
        
        # Ensure directories exist
        os.makedirs(os.path.dirname(output_pdf_path), exist_ok=True)
        
        doc = SimpleDocTemplate(
            output_pdf_path,
            pagesize=letter,
            rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54
        )
        
        styles = getSampleStyleSheet()
        
        # Determine fonts based on content (supports Devanagari via Noto)
        title_font = _get_bold_font_for_text(title)
        body_font = _get_font_for_text(content)
        bold_font = _get_bold_font_for_text(content)
        
        # Custom styles for a clean, readable print PDF
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Title'],
            fontName=title_font,
            fontSize=20,
            leading=24,
            textColor=colors.HexColor('#1E1E2F'),
            spaceAfter=15,
            alignment=0
        )
        
        heading_style = ParagraphStyle(
            'HeadingStyle',
            parent=styles['Heading2'],
            fontName=bold_font,
            fontSize=13,
            leading=17,
            textColor=colors.HexColor('#0056b3'),
            spaceBefore=12,
            spaceAfter=6
        )
        
        body_style = ParagraphStyle(
            'BodyStyle',
            parent=styles['BodyText'],
            fontName=body_font,
            fontSize=10,
            leading=14,
            textColor=colors.HexColor('#333333'),
            spaceAfter=6
        )
        
        story = []
        
        # Title
        story.append(Paragraph(title, title_style))
        story.append(Spacer(1, 0.15 * inch))
        
        # Split content into paragraphs
        lines = content.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                story.append(Spacer(1, 0.08 * inch))
                continue
                
            # Replace markdown **bold** with <b>bold</b> and *italic* with <i>italic</i>
            line = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', line)
            line = re.sub(r'\*(.*?)\*', r'<i>\1</i>', line)
            
            # Determine per-line font for mixed content
            line_font = _get_font_for_text(line)
            line_bold_font = _get_bold_font_for_text(line)
            
            # Check if heading
            if line.startswith('### '):
                h_style = ParagraphStyle('H3', parent=heading_style, fontName=line_bold_font)
                story.append(Paragraph(line[4:], h_style))
            elif line.startswith('## '):
                h_style = ParagraphStyle('H2', parent=heading_style, fontName=line_bold_font)
                story.append(Paragraph(line[3:], h_style))
            elif line.startswith('# '):
                t_style = ParagraphStyle('H1', parent=title_style, fontName=line_bold_font)
                story.append(Paragraph(line[2:], t_style))
            elif line.startswith('<b>') and line.endswith('</b>') and len(line) < 100:
                h_style = ParagraphStyle('BoldLine', parent=heading_style, fontName=line_bold_font)
                story.append(Paragraph(line, h_style))
            elif line.startswith('- ') or line.startswith('* '):
                b_style = ParagraphStyle('BulletStyle', parent=body_style, fontName=line_font, leftIndent=15)
                story.append(Paragraph(f"&bull; {line[2:]}", b_style))
            else:
                b_style = ParagraphStyle('Body', parent=body_style, fontName=line_font)
                story.append(Paragraph(line, b_style))
                
        # Build document
        doc.build(story)
        print("PDF generated successfully")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python pdfGenerator.py <json_path> <output_pdf_path>")
        sys.exit(1)
    generate_pdf(sys.argv[1], sys.argv[2])
