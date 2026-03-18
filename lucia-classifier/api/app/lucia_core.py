import pandas as pd
import numpy as np
from io import BytesIO
import base64
import matplotlib
matplotlib.use('Agg')  # Backend não-interativo para servidor
import matplotlib.pyplot as plt

def calcular_rfn(poro, perm):
    """
    Aplica a equação global revisada de Jennings & Lucia (2003) 
    para encontrar o Rock Fabric Number (RFN) exato.
    """
    if poro <= 0 or perm <= 0:
        return np.nan
        
    log_poro = np.log10(poro)
    log_perm = np.log10(perm)
    
    # Constantes exatas de Jennings & Lucia (2003)
    A, B, C, D = 9.7982, 12.0803, 8.6711, 8.2965
    
    try:
        # Fórmula matematicamente isolada para encontrar o log_RFN
        log_rfn = (A + C * log_poro - log_perm) / (B + D * log_poro)
        
        rfn = 10 ** log_rfn
        
        # RETORNA O VALOR BRUTO SEM ARREDONDAR PARA NÃO PERDER PRECISÃO NA FRONTEIRA
        return float(rfn) 
    except ZeroDivisionError:
        return np.nan


def classificar_lucia(rfn):
    """
    Classifica o reservatório com base no Rock Fabric Number.
    Resultados fora do escopo de Lucia (0.5 a 4.0) recebem "N.C".
    """
    if pd.isna(rfn):
        return "N.C"
    
    # Estabelecendo os limites reais para as 3 classes
    if 0.5 <= rfn <= 1.5:
        return "Classe 1"
    elif 1.5 < rfn <= 2.5:
        return "Classe 2"
    elif 2.5 < rfn <= 4.0:
        return "Classe 3"
    else:
        # Tudo que for menor que 0.5 ou maior que 4.0 será Não Classificado
        return "N.C"


def gerar_crossplot_lucia(df, col_poro, col_perm):
    """
    Gera um gráfico científico estilo Gnuplot com os pontos e 
    as linhas de fronteira das Classes de Lucia.
    """
    plt.figure(figsize=(10, 7))
    
    # Cores e Legendas
    cores = {'Classe 1': '#3b82f6', 'Classe 2': '#22c55e', 'Classe 3': '#ef4444', 'N.C': '#9ca3af'}
    
    # 1. Desenhar as linhas de fronteira (Lucia Boundaries)
    # log(K) = 9.7982 - 12.0803*log(RFN) + (8.6711 - 8.2965*log(RFN))*log(Poro)
    poro_array = np.linspace(0.01, 0.40, 100)
    log_poro_array = np.log10(poro_array)
    
    A, B, C, D = 9.7982, 12.0803, 8.6711, 8.2965
    
    for rfn_limit in [0.5, 1.5, 2.5, 4.0]:
        log_rfn = np.log10(rfn_limit)
        log_perm_array = (A - B * log_rfn) + (C - D * log_rfn) * log_poro_array
        plt.plot(poro_array, 10**log_perm_array, '--', color='gray', alpha=0.5, linewidth=1)
        # Adiciona etiqueta na linha
        plt.text(0.38, 10**(log_perm_array[-1]), f'RFN={rfn_limit}', fontsize=8, color='gray')

    # 2. Plotar os dados das amostras
    for classe, cor in cores.items():
        sub = df[df['Classe_Lucia'] == classe]
        if not sub.empty:
            plt.scatter(sub[col_poro], sub[col_perm], label=classe, color=cor, edgecolors='white', alpha=0.8, s=50)

    # Configurações de Eixo
    plt.xscale('log')
    plt.yscale('log')
    plt.xlabel(f'Porosidade ({col_poro})')
    plt.ylabel(f'Permeabilidade ({col_perm}) - Log Scale')
    plt.title('Crossplot de Petrofísica - Classificação de Lucia')
    plt.grid(True, which="both", ls="-", alpha=0.2)
    plt.legend()
    
    # Converte para Base64
    buf = BytesIO()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    plt.close()
    return base64.b64encode(buf.getvalue()).decode('utf-8')

def processar_planilha(file_bytes: bytes, col_poro: str, col_perm: str) -> dict:
    """
    Lê o Excel em memória, aplica os cálculos linha a linha, 
    gera dados para o gráfico e retorna o novo Excel em Base64.
    """
    df = pd.read_excel(BytesIO(file_bytes))
    
    # Validação rápida de colunas
    if col_poro not in df.columns or col_perm not in df.columns:
        raise ValueError("Colunas especificadas não encontradas na planilha.")

    # Converte para numérico, forçando erros para NaN
    df[col_poro] = pd.to_numeric(df[col_poro], errors='coerce')
    df[col_perm] = pd.to_numeric(df[col_perm], errors='coerce')

    # Calcula o RFN
    df['RFN_Calculado'] = df.apply(lambda row: calcular_rfn(row[col_poro], row[col_perm]), axis=1)
    
    # Aplica a classificação
    df['Classe_Lucia'] = df['RFN_Calculado'].apply(classificar_lucia)

    # 1. Prepara os dados pro gráfico Recharts (mantido por compatibilidade)
    df_grafico = df.dropna(subset=[col_poro, col_perm, 'Classe_Lucia'])
    dados_grafico = df_grafico[[col_poro, col_perm, 'Classe_Lucia']].to_dict(orient='records')

    # 2. Gera a imagem científica via Matplotlib
    grafico_img_b64 = gerar_crossplot_lucia(df_grafico, col_poro, col_perm)

    # 3. Salva o resultado em um buffer de memória
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Classificacao_Lucia')
    
    # 4. Converte o Excel para Base64
    excel_b64 = base64.b64encode(output.getvalue()).decode('utf-8')
    
    return {
        "dados_grafico": dados_grafico,
        "arquivo_b64": excel_b64,
        "grafico_img_b64": grafico_img_b64
    }

def extrair_colunas(file_bytes: bytes) -> list:
    """Lê apenas o cabeçalho do Excel para o Frontend montar o Dropdown."""
    df = pd.read_excel(BytesIO(file_bytes), nrows=0)
    return df.columns.tolist()
