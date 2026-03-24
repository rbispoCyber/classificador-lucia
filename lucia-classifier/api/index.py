import numpy as np
import pandas as pd
from io import BytesIO
import base64
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.lucia_core import processar_planilha, extrair_colunas

app = FastAPI(title="API Petrofísica - Classificação de Lucia e GHE")

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
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Erro em obter_colunas: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Erro no processamento do Excel: {str(e)}")

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
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Erro em processar_dados: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@app.post("/api/processar_ghe")
async def processar_ghe(file: UploadFile = File(...), col_poro: str = Form(...), col_perm: str = Form(...)):
    try:
        contents = await file.read()
        df = pd.read_excel(BytesIO(contents), engine='openpyxl')
    except Exception as e:
        print(f"Erro ao ler Excel no GHE: {e}")
        raise HTTPException(status_code=400, detail=f"Erro ao ler o arquivo Excel: {str(e)}")

    if col_poro not in df.columns or col_perm not in df.columns:
        raise HTTPException(status_code=400, detail="As colunas selecionadas não existem na planilha.")

    df[col_poro] = pd.to_numeric(df[col_poro], errors='coerce')
    df[col_perm] = pd.to_numeric(df[col_perm], errors='coerce')
    df = df.dropna(subset=[col_poro, col_perm]).copy()

    # Trava GHE: Porosidade não pode ser 0, negativa, nem >= 1 (100%). Permeabilidade > 0.
    df = df[(df[col_poro] > 0) & (df[col_poro] < 1) & (df[col_perm] > 0)]

    if df.empty:
        raise HTTPException(status_code=400, detail="Após a limpeza, não sobrou nenhum dado válido para GHE.")

    # ==========================================
    # MATEMÁTICA DO GHE (Amaefule et al., 1993)
    # ==========================================
    
    # 1. RQI (Reservoir Quality Index) em micrômetros
    df['RQI'] = 0.0314 * np.sqrt(df[col_perm] / df[col_poro])
    
    # 2. Phi_z (Pore-to-Matrix Ratio)
    df['Phi_z'] = df[col_poro] / (1 - df[col_poro])
    
    # 3. FZI (Flow Zone Indicator)
    df['FZI'] = df['RQI'] / df['Phi_z']
    df['Log_FZI'] = np.log10(df['FZI'])
    
    # 4. Classificação exata nas 10 Unidades de Fluxo (GHE 01 a GHE 10)
    # Estes são os limites matemáticos (pontos médios logarítmicos) entre as 10 curvas 
    # que desenhamos no gráfico. Eles decidem onde uma classe termina e a outra começa.
    limites_fzi = [0, 0.0866, 0.2738, 0.866, 2.598, 7.794, 23.238, 69.282, 207.846, 600.0, float('inf')]
    nomes_ghe = ['GHE 01', 'GHE 02', 'GHE 03', 'GHE 04', 'GHE 05', 'GHE 06', 'GHE 07', 'GHE 08', 'GHE 09', 'GHE 10']
    
    # Fatiamento automático
    df['Classe_GHE'] = pd.cut(df['FZI'], bins=limites_fzi, labels=nomes_ghe)
    
    # Converte para texto e protege contra dados nulos
    df['Classe_GHE'] = df['Classe_GHE'].astype(str).replace('nan', 'N.C')

    # Prepara para exportação
    # Para evitar erros de serialização JSON (ValueError: Out of range float values are not JSON compliant)
    # garantimos que qualquer NaN/Inf vire None.
    df_export = df.replace([np.inf, -np.inf], np.nan)
    df_export = df_export.where(pd.notnull(df_export), None)
    dados_grafico = df_export.to_dict(orient='records')
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='GHE_Classificado')
    output.seek(0)
    arquivo_b64 = base64.b64encode(output.read()).decode('utf-8')

    return {"dados_grafico": dados_grafico, "arquivo_b64": arquivo_b64}
    
@app.exception_handler(Exception)
async def internal_exception_handler(request, exc):
    import traceback
    error_detail = traceback.format_exc()
    print(f"EXCEPTION GLOBAL [{request.url.path}]: {error_detail}")
    return JSONResponse(status_code=500, content={"detail": str(exc), "trace": error_detail})


