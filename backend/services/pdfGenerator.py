import sys
import json
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

def generate_pdf(json_path, output_pdf_path):
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        title = data.get("title", "Research Document")
        content = data.get("content", "")
        
        # Ensure directories exist
        os.makedirs(os.path.dirname(output_pdf_path), exist_ok=True)
        
        # Unicode / Devanagari Font Registration
        default_font_name = 'Helvetica'
        default_bold_font_name = 'Helvetica-Bold'
        
        for font_dir in [r"C:\Windows\Fonts", "/usr/share/fonts/truetype/dejavu", "/Library/Fonts"]:
            mangal_file = os.path.join(font_dir, "Mangal.ttf")
            mangalb_file = os.path.join(font_dir, "Mangalb.ttf")
            if os.path.exists(mangal_file) and os.path.exists(mangalb_file):
                try:
                    pdfmetrics.registerFont(TTFont('Mangal', mangal_file))
                    pdfmetrics.registerFont(TTFont('Mangal-Bold', mangalb_file))
                    default_font_name = 'Mangal'
                    default_bold_font_name = 'Mangal-Bold'
                    break
                except Exception as e:
                    print(f"Font register warning: {e}")

        doc = SimpleDocTemplate(
            output_pdf_path,
            pagesize=letter,
            rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54
        )
        
        styles = getSampleStyleSheet()
        
        # Custom styles for a clean, readable print PDF
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Title'],
            fontName=default_bold_font_name,
            fontSize=20,
            leading=24,
            textColor=colors.HexColor('#1E1E2F'),
            spaceAfter=15,
            alignment=0 # Left aligned
        )
        
        heading_style = ParagraphStyle(
            'HeadingStyle',
            parent=styles['Heading2'],
            fontName=default_bold_font_name,
            fontSize=13,
            leading=17,
            textColor=colors.HexColor('#0056b3'),
            spaceBefore=12,
            spaceAfter=6
        )
        
        body_style = ParagraphStyle(
            'BodyStyle',
            parent=styles['BodyText'],
            fontName=default_font_name,
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
        import re
        lines = content.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                story.append(Spacer(1, 0.08 * inch))
                continue
                
            # Replace markdown **bold** with <b>bold</b> and *italic* with <i>italic</i>
            line = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', line)
            line = re.sub(r'\*(.*?)\*', r'<i>\1</i>', line)
            
            # Check if heading
            if line.startswith('### '):
                story.append(Paragraph(line[4:], heading_style))
            elif line.startswith('## '):
                story.append(Paragraph(line[3:], heading_style))
            elif line.startswith('# '):
                story.append(Paragraph(line[2:], title_style))
            elif line.startswith('<b>') and line.endswith('</b>') and len(line) < 100:
                # Treat pure bold markdown lines as subheadings for clean PDF spacing
                story.append(Paragraph(line, heading_style))
            elif line.startswith('- ') or line.startswith('* '):
                # Bullet points
                bullet_style = ParagraphStyle(
                    'BulletStyle',
                    parent=body_style,
                    leftIndent=15
                )
                story.append(Paragraph(f"&bull; {line[2:]}", bullet_style))
            else:
                story.append(Paragraph(line, body_style))
                
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
