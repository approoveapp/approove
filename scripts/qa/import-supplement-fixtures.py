"""Additional synthetic fixtures; gold is an expectation, never an AI result.
Uses bundled Python with Pillow/reportlab/pypdf. Run from the isolated QA copy.
"""
from pathlib import Path
import csv, io, json, shutil
from PIL import Image, ImageDraw
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2] / 'docs/qa/2026-10-23-ai-import'
F = ROOT / 'fixtures/supplement'
F.mkdir(parents=True, exist_ok=True)

def post(i, title=None):
    return dict(date=f'2026-11-{i:02d}', time='09:30', dateIsSuggested=False,
        channel='Instagram', format='feed', title=title or f'Card {i:02d}',
        copyText=f'Oficina Aurora. Ideia {i:02d}.\nConheca nosso trabalho.', media=[], notes=None,
        source=f'Fixture suplementar, registro {i}')

def gold(name, docs, media, posts, criteria):
    d=F/name; d.mkdir(exist_ok=True)
    data=dict(id=name, status='expected_only_no_ai_execution', client='Oficina Aurora (fictícia)',
        timezone='America/Sao_Paulo',referenceDate='2026-10-23',documents=docs,media=media,
        expectedPosts=len(posts) if posts is not None else None, criteria=criteria)
    if posts is not None: data['proposal']=dict(summary='Expectativa humana da fixture.',posts=posts,warnings=criteria)
    (d/'expected.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
    return d

posts=[post(i) for i in range(1,13)]
posts[7]['channel']='LinkedIn'; posts[7]['time']=None
posts[10]['copyText']=''
d=gold('07-pdf-raster', ['apresentacao-parcialmente-rasterizada.pdf'], [], posts, [
    '12 cards = 12 posts; cabeçalho e marca não viram publicações.',
    'Página 4 rasterizada contém cards 07 e 08; leitura visual/OCR necessária.',
    'Card 08 não tem horário; não inventar meia-noite. Card 11 não tem legenda final.',
    'Arte embutida no PDF não é um arquivo de mídia disponível no importador atual.',
    'Preservar copy literal e quebras, sem aprovação ou publicação automática.'])

def page_pdf(items, page):
    raw=io.BytesIO(); c=canvas.Canvas(raw,pagesize=(960,720))
    c.setFillColorRGB(.97,.96,.93); c.rect(0,0,960,720,fill=1,stroke=0)
    c.setFillColorRGB(.09,.24,.22);c.setFont('Helvetica-Bold',23)
    c.drawString(36,680,'OFICINA AURORA / CALENDARIO DE NOVEMBRO')
    c.setFont('Helvetica',12);c.drawString(36,653,'Fuso America/Sao_Paulo. Material ficticio. Cabecalho nao e post.')
    for index,p in enumerate(items):
        top=606-index*280
        c.setFillColorRGB(1,1,1);c.roundRect(30,top-239,900,250,10,fill=1,stroke=0)
        c.setFillColorRGB(.09,.24,.22);c.setFont('Helvetica-Bold',20);c.drawString(50,top-25,p['title'])
        c.setFont('Helvetica',14)
        texts=[f"{p['date']} | {p['time'] or 'Horario ausente'} | {p['channel']} | {p['format']}",
            'Legenda final:',*(p['copyText'].split('\n') if p['copyText'] else ['(ausente; apenas ideia)'])]
        for j,line in enumerate(texts): c.drawString(50,top-60-j*25,line)
        c.setFillColorRGB(.09,.37,.34);c.roundRect(730,top-205,165,160,8,fill=1,stroke=0)
        c.setFillColorRGB(.85,.95,.59);c.setFont('Helvetica-Bold',13);c.drawString(745,top-110,'ARTE FICTICIA')
        c.setFont('Helvetica',10);c.drawString(745,top-135,'Dentro do PDF')
    c.setFillColorRGB(.09,.24,.22);c.setFont('Helvetica',10);c.drawString(36,20,f'Pagina {page}/6 - revisao humana obrigatoria')
    c.save();return raw.getvalue()

# Render only page 4 to pixels before embedding, leaving no hidden text layer.
import subprocess, tempfile
with tempfile.TemporaryDirectory(prefix='approove-fixture-pdf-') as tmp:
    tmp=Path(tmp); raster_source=tmp/'page4.pdf';raster_source.write_bytes(page_pdf(posts[6:8],4))
    subprocess.run(['/Users/murillo/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/bin/pdftoppm',
        '-r','120','-singlefile','-png',str(raster_source),str(tmp/'raster')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    shutil.copy2(tmp/'raster.png',d/'page-04-raster-source.png')
    from pypdf import PdfWriter
    writer=PdfWriter()
    for page in range(1,7):
        if page==4:
            raw=io.BytesIO();c=canvas.Canvas(raw,pagesize=(960,720));c.drawImage(str(tmp/'raster.png'),0,0,960,720);c.save();source=raw.getvalue()
        else: source=page_pdf(posts[(page-1)*2:page*2],page)
        writer.add_page(PdfReader(io.BytesIO(source)).pages[0])
    with (d/'apresentacao-parcialmente-rasterizada.pdf').open('wb') as f: writer.write(f)
reader=PdfReader(d/'apresentacao-parcialmente-rasterizada.pdf')
assert len(reader.pages)==6 and not reader.pages[3].extract_text().strip()
assert all(reader.pages[i].extract_text().strip() for i in [0,1,2,4,5])

media=['asset-a.png','asset-b.png','asset-c.png','asset-d.png','asset-e.png','asset-f.mp4','asset-g.png','asset-h.png']
posts=[post(i,f'Manifesto {i:02d}') for i in range(1,5)]
posts[0].update(format='carousel',media=media[:4])
posts[1]['media']=['asset-e.png']
posts[2].update(format='reels',media=['asset-f.mp4','asset-g.png'])
posts[3]['media']=['asset-h.png']
criteria=['8 arquivos representam 4 posts: carrossel de 4, imagem avulsa, vídeo com capa, outra imagem avulsa.',
    'Preservar ordem a,b,c,d e distinguir capa g do vídeo f; capa não é um post extra.',
    'Schema atual não possui papel separado para capa: exigir alerta/revisão, não tratar a lista como suporte completo a capa.',
    'Legendas/datas/canais explícitos; nenhuma aprovação pode ser inferida.']
d=gold('08-manifesto', ['manifesto.txt'], media,posts,criteria)
for i,n in enumerate(media):
    if n.endswith('.mp4'): shutil.copy2(ROOT/'fixtures/05-misto/bastidores.mp4',d/n);continue
    im=Image.new('RGB',(800,800),['#165E57','#653F57','#264663'][i%3]);draw=ImageDraw.Draw(im)
    draw.text((65,95),'OFICINA AURORA',fill='white',font_size=44)
    draw.text((65,320),n,fill='#D9F296',font_size=56)
    draw.text((65,680),'Material ficticio',fill='white',font_size=30);im.save(d/n)
manifest=dict(client='Oficina Aurora (fictícia)',timezone='America/Sao_Paulo',posts=[
    dict(p, assets=[dict(filename=n,role='cover' if n=='asset-g.png' else 'video' if n.endswith('.mp4') else 'slide',order=i+1) for i,n in enumerate(p['media'])]) for p in posts])
(d/'manifesto.txt').write_text('MANIFESTO EXPLÍCITO. Um objeto posts = uma publicação. Capa é vinculada ao vídeo, não novo post.\n'+json.dumps(manifest,ensure_ascii=False,indent=2))
no=gold('08-sem-manifesto',['instrucoes.txt'],media,None,[
    'Não é possível inferir 4 posts dos 8 arquivos sem mapeamento. Não avaliar por contagem 4.',
    'Solicitar agrupamento/ordem/capa e campos faltantes; não inventar legendas, datas ou canais.',
    'Datas sugeridas devem estar marcadas, não representadas como datas vindas da fonte. Revisão humana obrigatória.'])
for n in media: shutil.copy2(d/n,no/n)
(no/'instrucoes.txt').write_text('Seguem oito mídias de uma campanha fictícia. Ainda não informei agrupamento, ordem, legendas, datas ou canais. Sinalize as ausências para eu revisar; não invente esses dados.')

posts=[]
for i in range(110):
    p=post(i%28+1, f'CSV {i+1:03d}');p['time']=f'{8+i//28:02d}:30'
    p['copyText']=f'Olá ☀️; pauta "{i+1:03d}".\nVeja https://example.com/pauta/{i+1}';posts.append(p)
# Same copy, different date/channel are intentional recurring posts and must survive.
posts[1]['copyText']=posts[0]['copyText'];posts[2]['copyText']=posts[0]['copyText'];posts[2]['channel']='LinkedIn'
posts[3]['time']=None;posts[4]['copyText']=''
d=gold('09-csv-120',['calendario-120.csv'],[],posts,[
    '120 registros: 110 únicos + 10 cópias exatas (últimos 10 = primeiros 10).',
    'Proposta ideal: 110 posts e alerta dos 10 duplicados, decisão humana antes de excluir.',
    'CSV 001/002/003 repetem copy intencionalmente em outro dia/canal: manter os três.',
    'CSV 004 sem hora, CSV 005 sem copy. CSV 006 tem data textual ambígua, confirmar 06/11/2026.',
    'Separador ponto-e-vírgula, UTF-8, emoji, aspas e quebras internas devem permanecer.'])
rows=[]
for i,p in enumerate(posts): rows.append([p['date'] if i!=5 else 'primeira sexta de novembro de 2026',p['time'] or '',p['channel'],p['format'],p['title'],p['copyText'],'recorrência intencional' if i in [1,2] else ''])
posts[5]['dateIsSuggested']=True
# Update gold with ambiguity after source rows are composed.
obj=json.loads((d/'expected.json').read_text());obj['proposal']['posts']=posts;(d/'expected.json').write_text(json.dumps(obj,ensure_ascii=False,indent=2))
with (d/'calendario-120.csv').open('w',newline='') as f:
    w=csv.writer(f,delimiter=';');w.writerow(['data','hora','canal','formato','titulo','legenda','nota']);w.writerows(rows+rows[:10])

posts=[post(i,f'Mensal {i:02d}') for i in range(1,31)]
for i,p in enumerate(posts):
    p['channel']='LinkedIn' if i%3==0 else 'Instagram'
    p['copyText']=f'Novembro, dia {i+1}.\nPauta fictícia; copy final.'
posts[5]['time']=None;posts[10]['copyText']=''
d=gold('10-xlsx-30',['novembro.xlsx'],[],posts,[
    '30 posts em duas abas de 15; ignorar abas Legenda e Analytics.',
    'Cabeçalhos mesclados, datas numéricas Excel e textuais; horas ausentes devem continuar ausentes.',
    'Mensal 06 sem hora e Mensal 11 sem copy. URLs são referências, nunca mídia disponível.',
    'Datas/copy/canais não concedem aprovação. Revisar tudo antes do commit.'])
(d/'rows.json').write_text(json.dumps(posts,ensure_ascii=False,indent=2))
print('Supplement fixtures generated (expectations only):',F)
