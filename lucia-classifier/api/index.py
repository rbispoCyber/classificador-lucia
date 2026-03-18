from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from api.app.lucia_core import processar_planilha, extrair_colunas

app = FastAPI(title="API Petrofísica - Classificação de Lucia")

# Configuração de CORS para permitir que o React converse com o FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Em produção, coloque a URL do frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/colunas")
async def obter_colunas(file: UploadFile = File(...)):
    """Recebe o arquivo e devolve os nomes das colunas para o usuário escolher."""
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="O arquivo deve ser um Excel (.xlsx ou .xls)")
    
    try:
        conteudo = await file.read()
        colunas = extrair_colunas(conteudo)
        return JSONResponse(content={"colunas": colunas})
    except Exception as e:
        print(f"Erro em obter_colunas: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/processar")
async def processar_dados(
    file: UploadFile = File(...),
    col_poro: str = Form(...),
    col_perm: str = Form(...)
):
    """Recebe o arquivo e as colunas escolhidas, processa e devolve JSON com dados do gráfico e Excel b64."""
    try:
        conteudo = await file.read()
        resultado = processar_planilha(conteudo, col_poro, col_perm)
        # Agora retornamos um JSON puro
        return JSONResponse(content=resultado)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

