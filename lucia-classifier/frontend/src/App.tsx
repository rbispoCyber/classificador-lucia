import React, { useState, useRef, useEffect, type DragEvent } from 'react';

// Molde da memória de histórico
interface ArquivoSalvo {
  id: string;
  nomeArquivo: string;
  dataHora: string;
  dados: any[];
}
import * as XLSX from 'xlsx';
import Plot from 'react-plotly.js'; // Importando o Plotly para o gráfico único
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis, CartesianGrid } from 'recharts';
import RockCore3D from './components/RockCore3D';

// Quando colocarmos o backend no Render, colaremos o link oficial aqui!
// Por enquanto, deixe o localhost para continuar funcionando no seu computador.
export const API_URL = "http://localhost:8000";

// Interface para o ElectronAPI (Preload)
declare global {
  interface Window {
    electronAPI?: {
      openFileDialog: () => Promise<{ name: string, data: any } | null>;
      openFolderDialog: () => Promise<string | null>;
      isElectron: boolean;
    };
  }
}

function App() {
  // Estado do histórico (últimas 5 análises)
  const [historico, setHistorico] = useState<ArquivoSalvo[]>([]);

  // Ao abrir o app, recupera o histórico salvo no HD
  useEffect(() => {
    const historicoSalvo = localStorage.getItem('@PoroK_Historico');
    if (historicoSalvo) {
      setHistorico(JSON.parse(historicoSalvo));
    }
  }, []);
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [poroCol, setPoroCol] = useState<string>('nenhum');
  const [permCol, setPermCol] = useState<string>('nenhum');

  const [chartData, setChartData] = useState<any[]>([]);
  const [eixoX, setEixoX] = useState<string>('nenhum');
  const [eixoY, setEixoY] = useState<string>('nenhum');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Adicione este novo estado junto com os outros
  const [abaAtiva, setAbaAtiva] = useState<'lucia' | 'ghe'>('lucia');

  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [chartTheme, setChartTheme] = useState<'dark' | 'light'>('light');
  const [hoveredClass, setHoveredClass] = useState<string | null>(null);

  const coresClasses: Record<string, string> = {
    'Classe 1': '#22d3ee', // bg-cyan-400
    'Classe 2': '#34d399', // bg-emerald-400
    'Classe 3': '#fb7185', // bg-rose-400
    'N.C': '#64748b'       // bg-slate-500
  };

  const nomes_ghe = ['N.C', 'GHE 01', 'GHE 02', 'GHE 03', 'GHE 04', 'GHE 05', 'GHE 06', 'GHE 07', 'GHE 08', 'GHE 09', 'GHE 10'];
  const cores_paleta_ghe = ['#9ca3af', '#e11d48', '#ea580c', '#d97706', '#65a30d', '#16a34a', '#059669', '#0891b2', '#2563eb', '#4f46e5', '#475569'];
  const coresGhe: Record<string, string> = {};
  nomes_ghe.forEach((nome, i) => coresGhe[nome] = cores_paleta_ghe[i]);

  const getCorClasse = (classe: string) => {
    if (!classe) return '#64748b';
    if (classe.startsWith('Classe')) return coresClasses[classe] || '#64748b';
    return coresGhe[classe] || '#64748b';
  };

  const handleDragOver = (e: DragEvent<HTMLElement>) => e.preventDefault();
  const handleDrop = async (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) await processarUpload(e.dataTransfer.files[0]);
  };
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) await processarUpload(e.target.files[0]);
  };

  const handleNativeUpload = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.openFileDialog();
      if (result) {
        if ('error' in result) {
          alert(result.error);
          return;
        }
        await processarUpload(result);
      }
    }
  };

  const processarUpload = async (selectedFile: File | { name: string, data: any, error?: string }) => {
    if (!selectedFile.name || (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls'))) {
      alert("Envie apenas arquivos Excel (.xlsx ou .xls)");
      return;
    }
    
    // Convertemos para um objeto File-like para o estado se for do Electron
    if ('data' in selectedFile) {
       // Mock de objeto File para manter compatibilidade com o estado existente
       // Agora incluímos o método arrayBuffer para que as etapas seguintes consigam ler os dados
       setFile({ 
         name: selectedFile.name, 
         arrayBuffer: async () => selectedFile.data 
       } as any);
    } else {
       setFile(selectedFile);
    }
    
    try {
      // LEITURA 100% OFFLINE DAS COLUNAS
      let data;
      if ('data' in selectedFile) {
        data = selectedFile.data;
      } else {
        data = await selectedFile.arrayBuffer();
      }
      
      // No Electron (nodeIntegration: true/contextIsolation: false), o data vindo do IPC pode ser um Buffer.
      // A biblioteca XLSX lê Buffers nativamente com o tipo 'buffer' ou detecta automaticamente sem o campo type.
      const workbook = XLSX.read(data, { type: 'array' });
      
      const primeiraAba = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[primeiraAba];
      
      // header: 1 retorna um array de arrays (linhas)
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
      
      if (json.length > 0) {
        // Tenta encontrar a primeira linha que não seja totalmente vazia para servir de header
        const headerRow = (json as any[]).find(row => Array.isArray(row) && row.some(cell => String(cell).trim() !== ""));
        
        if (headerRow) {
          const headers = (headerRow as any[]).map(h => String(h || "").trim()).filter(h => h !== "");
          setColumns(headers);
          setStep(2);
        } else {
          alert("Não conseguimos identificar nenhuma coluna preenchida no arquivo.");
        }
      } else {
        alert("O arquivo parece estar vazio ou não contém abas válidas.");
      }
    } catch (error: any) {
      console.error("Erro na leitura offline:", error);
      setErrorMsg("Erro ao ler colunas do arquivo localmente.");
    }
  };

  const handleClassificar = async () => {
    if (!file || poroCol === 'nenhum' || permCol === 'nenhum') return;
    setIsProcessing(true);
    setErrorMsg(null);

    // Atraso simulado de 900ms para a animação "Fake Loading"
    await new Promise(r => setTimeout(r, 900));

    // LÓGICA 100% OFFLINE PARA CLASSIFICAR
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      // Usamos uma leitura mais profunda caso as colunas tenham espaços ou nomes ligeiramente diferentes
      const df_raw = XLSX.utils.sheet_to_json(worksheet, { defval: 0 });
      // Normalização: Trim nas chaves das colunas para evitar incompatibilidade com o estado columns
      const df = (df_raw as any[]).map(row => {
        const newRow: any = {};
        Object.keys(row).forEach(k => {
          const cleanKey = k.trim();
          newRow[cleanKey] = row[k];
        });
        return newRow;
      });

      const A = 9.7982, B = 12.0803, C = 8.6711, D = 8.2965;
      const limites_ghe = [0.0938, 0.1875, 0.375, 0.75, 1.5, 3.0, 6.0, 12.0, 24.0, 48.0];

      const toNum = (val: any) => {
        if (typeof val === 'string') val = val.replace(',', '.');
        return Number(val);
      };

      const resultados = df.map((linha: any) => {
        let phi = toNum(linha[poroCol] || linha.Porosidade || 0);
        const k = toNum(linha[permCol] || linha.Permeabilidade || 0);
        
        // Auto-detecta porcentagem (ex: 15 ao invés de 0.15)
        if (phi > 1) phi = phi / 100;

        let rfn = 0, classeLucia = "N.C";
        let fzi = 0, classeGhe = "N.C";

        if (phi > 0 && phi < 1 && k > 0) {
          // --- LUCIA ---
          const logK = Math.log10(k);
          const logPhi = Math.log10(phi);
          const logRfn = (logK - A - C * logPhi) / (-B - D * logPhi);
          rfn = Math.pow(10, logRfn);
          if (rfn < 1.5) classeLucia = 'Classe 1';
          else if (rfn < 2.5) classeLucia = 'Classe 2';
          else if (rfn < 4.0) classeLucia = 'Classe 3';

          // --- GHE ---
          const rqi = 0.0314 * Math.sqrt(k / phi);
          const phi_z = phi / (1 - phi);
          fzi = rqi / phi_z;
          if (fzi < limites_ghe[0]) classeGhe = "N.C";
          else if (fzi < limites_ghe[1]) classeGhe = "GHE 01";
          else if (fzi < limites_ghe[2]) classeGhe = "GHE 02";
          else if (fzi < limites_ghe[3]) classeGhe = "GHE 03";
          else if (fzi < limites_ghe[4]) classeGhe = "GHE 04";
          else if (fzi < limites_ghe[5]) classeGhe = "GHE 05";
          else if (fzi < limites_ghe[6]) classeGhe = "GHE 06";
          else if (fzi < limites_ghe[7]) classeGhe = "GHE 07";
          else if (fzi < limites_ghe[8]) classeGhe = "GHE 08";
          else if (fzi < limites_ghe[9]) classeGhe = "GHE 09";
          else classeGhe = "GHE 10";
        }

        return {
          ...linha,
          Porosidade: phi,
          Permeabilidade: k,
          RFN_Calculado: rfn,
          Classe_Lucia: classeLucia,
          FZI: fzi,
          Classe_GHE: classeGhe
        };
      }).filter(r => r.Porosidade > 0 && r.Permeabilidade > 0);

      setChartData(resultados);
      setEixoX(poroCol);
      setEixoY(permCol);

      // === SALVAR NO HISTÓRICO ao processar ===
      if (file) {
        const novaAnalise: ArquivoSalvo = {
          id: crypto.randomUUID(),
          nomeArquivo: file.name,
          dataHora: new Date().toLocaleString('pt-BR'),
          dados: resultados,
        };
        setHistorico(prev => {
          const novaLista = [novaAnalise, ...prev];
          const ultimos5 = novaLista.slice(0, 5);
          localStorage.setItem('@PoroK_Historico', JSON.stringify(ultimos5));
          return ultimos5;
        });
      }

      // Gera o Excel para download da aba atual
      const novaWS = XLSX.utils.json_to_sheet(resultados);
      const novoWB = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(novoWB, novaWS, abaAtiva === 'lucia' ? "Lucia" : "GHE");
      const excelBuffer = XLSX.write(novoWB, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      setDownloadUrl(window.URL.createObjectURL(blob));
      
      setStep(3);
    } catch (error: any) {
      console.error("Erro no processamento offline:", error);
      setErrorMsg("Erro ao processar dados localmente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const baixarRelatorioCompletoOffline = async () => {
    if (!file || poroCol === 'nenhum' || permCol === 'nenhum') return;
    setIsProcessing(true);
    setErrorMsg(null);
    
    try {
      // 1. Lê o arquivo Excel localmente
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const primeiraAba = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[primeiraAba];
      const df_raw = XLSX.utils.sheet_to_json(worksheet);
      const df = (df_raw as any[]).map(row => {
        const newRow: any = {};
        Object.keys(row).forEach(k => newRow[k.trim()] = row[k]);
        return newRow;
      });

      // 2. Motor Matemático Offline (Lucia + GHE)
      const A = 9.7982, B = 12.0803, C = 8.6711, D = 8.2965;
      const limites_ghe = [0.0938, 0.1875, 0.375, 0.75, 1.5, 3.0, 6.0, 12.0, 24.0, 48.0];

      const toNum = (val: any) => {
        if (typeof val === 'string') val = val.replace(',', '.');
        return Number(val);
      };

      const dadosProcessados = df.map((linha: any) => {
        let phi = toNum(linha[poroCol] || linha.Porosidade || linha.PHI || 0);
        const k = toNum(linha[permCol] || linha.Permeabilidade || linha.K || 0);

        // Auto-detecta porcentagem
        if (phi > 1) phi = phi / 100;

        let rfn = 0, classeLucia = "N.C";
        let fzi = 0, classeGhe = "N.C";

        if (phi > 0 && phi < 1 && k > 0) {
          // --- LUCIA ---
          const logK = Math.log10(k);
          const logPhi = Math.log10(phi);
          const logRfn = (logK - A - C * logPhi) / (-B - D * logPhi);
          rfn = Math.pow(10, logRfn);
          if (rfn < 1.5) classeLucia = 'Classe 1';
          else if (rfn < 2.5) classeLucia = 'Classe 2';
          else if (rfn < 4.0) classeLucia = 'Classe 3';

          // --- GHE (Amaefule + Corbett) ---
          const rqi = 0.0314 * Math.sqrt(k / phi);
          const phi_z = phi / (1 - phi);
          fzi = rqi / phi_z;
          
          if (fzi < limites_ghe[0]) classeGhe = "N.C";
          else if (fzi < limites_ghe[1]) classeGhe = "GHE 01";
          else if (fzi < limites_ghe[2]) classeGhe = "GHE 02";
          else if (fzi < limites_ghe[3]) classeGhe = "GHE 03";
          else if (fzi < limites_ghe[4]) classeGhe = "GHE 04";
          else if (fzi < limites_ghe[5]) classeGhe = "GHE 05";
          else if (fzi < limites_ghe[6]) classeGhe = "GHE 06";
          else if (fzi < limites_ghe[7]) classeGhe = "GHE 07";
          else if (fzi < limites_ghe[8]) classeGhe = "GHE 08";
          else if (fzi < limites_ghe[9]) classeGhe = "GHE 09";
          else classeGhe = "GHE 10";
        }

        return {
          ...linha,
          "RFN_Lucia": rfn > 0 ? rfn.toFixed(4) : "N.C",
          "Classe_Lucia": classeLucia,
          "FZI_GHE": fzi > 0 ? fzi.toFixed(4) : "N.C",
          "Classe_GHE": classeGhe
        };
      });

      // 3. Exporta diretamente pelo navegador
      const novaWS = XLSX.utils.json_to_sheet(dadosProcessados);
      const novoWB = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(novoWB, novaWS, "Analise_Completa_RonCore");
      XLSX.writeFile(novoWB, "RonCore_Analise_Completa.xlsx");

    } catch (error) {
      console.error("Erro no processamento offline:", error);
      alert("Erro ao processar arquivo localmente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null); setColumns([]); setPoroCol('nenhum'); setPermCol('nenhum');
    setEixoX('nenhum'); setEixoY('nenhum'); setChartData([]); setDownloadUrl(null); setStep(1);
    setErrorMsg(null);
  };

  // --- PREPARAÇÃO DE DADOS PARA OS GRAFICOS SECUNDÁRIOS (RECHARTS NEON) ---
  const obterDadosDistribuicao = () => {
    const contagem: Record<string, number> = {};
    chartData.forEach(d => {
      const c = abaAtiva === 'lucia' ? d.Classe_Lucia : d.Classe_GHE;
      if (c && c !== 'N.C') {
        contagem[c] = (contagem[c] || 0) + 1;
      }
    });
    return Object.keys(contagem).map(key => ({
      nome: key,
      quantidade: contagem[key],
      fill: getCorClasse(key)
    })).sort((a, b) => a.nome.localeCompare(b.nome));
  };

  const obterDadosDispersaoSecundaria = () => {
    const rawData = chartData.map(d => {
      const poro = Number(d.Porosidade || d[eixoX] || d['Porosidade (frac)'] || 0);
      const perm = Number(d.Permeabilidade || d[eixoY] || d['K (mD)'] || 0);
      return {
        poro: poro,
        perm: perm,
        parametro: abaAtiva === 'lucia' ? Number(d.RFN_Calculado) : Number(d.FZI),
        classe: abaAtiva === 'lucia' ? d.Classe_Lucia : d.Classe_GHE,
        fill: getCorClasse(abaAtiva === 'lucia' ? d.Classe_Lucia : d.Classe_GHE)
      };
    });
    return rawData.filter(d => !isNaN(d.parametro) && d.parametro > 0 && d.poro > 0 && d.perm > 0 && d.classe !== 'N.C');
  };

  const contribuicoesRef = chartData.length > 0 ? obterDadosDistribuicao() : [];
  const distribuicaoData = contribuicoesRef;
  const dispersaoData = chartData.length > 0 ? obterDadosDispersaoSecundaria() : [];
  
  const dominantClass = distribuicaoData.length > 0 
    ? [...distribuicaoData].sort((a, b) => b.quantidade - a.quantidade)[0].nome 
    : 'N.C';

  // Criação dos objetos de legenda customizados para alinhamento de cores
  const legendPayloadLucia = ['Classe 1', 'Classe 2', 'Classe 3'].map(c => ({ id: c, value: c, type: 'circle' as const, color: getCorClasse(c) }));
  const classesGhePresentes = chartData.length > 0 ? Array.from(new Set(chartData.map(d => d.Classe_GHE))).filter(c => c && c !== 'N.C').sort() as string[] : [];
  const legendPayloadGhe = classesGhePresentes.map(c => ({ id: c, value: c, type: 'circle' as const, color: getCorClasse(c) }));
  const currentLegendPayload = abaAtiva === 'lucia' ? legendPayloadLucia : legendPayloadGhe;

  // --- LÓGICA DO PLOTLY (Gráfico 1 - Interativo com Zoom e Curvas) ---
  const montarDadosPlotly = () => {
    const classes = ['Classe 1', 'Classe 2', 'Classe 3', 'N.C'];
    const rfns_limites = [0.5, 1.5, 2.5, 4.0];
    const A = 9.7982, B = 12.0803, C = 8.6711, D = 8.2965;

    // 1. Monta os pontos das rochas
    const traces = classes.map(classe => {
      const dadosFiltrados = chartData.filter(d => {
        const poro = Number(d.Porosidade || d[eixoX] || 0);
        const perm = Number(d.Permeabilidade || d[eixoY] || 0);
        return d.Classe_Lucia === classe && poro > 0 && perm > 0;
      });
      return {
        x: dadosFiltrados.map(d => Number(d.Porosidade || d[eixoX] || 0)),
        y: dadosFiltrados.map(d => Number(d.Permeabilidade || d[eixoY] || 0)),
        text: dadosFiltrados.map(d => `RFN: ${d.RFN_Calculado ? d.RFN_Calculado.toFixed(4) : 'N/A'}`),
        mode: 'markers',
        type: 'scatter',
        name: classe,
        marker: { color: coresClasses[classe], size: 7, opacity: hoveredClass ? (classe === hoveredClass ? 1.0 : 0.15) : 0.8 },
        hovertemplate: `<b>${classe}</b><br>Φ: %{x:.4f}<br>K: %{y:.2e} mD<br>%{text}<extra></extra>`
      };
    }).filter(trace => trace.x.length > 0);

    // 2. Monta as curvas exponenciais (para bater com o eixo X linear)
    const curvas = rfns_limites.map(rfn => {
      const logRfn = Math.log10(rfn);
      const x = [], y = [];
      for (let p = 0.005; p <= 0.4; p += 0.01) {
        const logK = (A - B * logRfn) + (C - D * logRfn) * Math.log10(p);
        x.push(p); y.push(Math.pow(10, logK));
      }
      return {
        x: x, y: y, mode: 'lines',
        type: 'scatter',
        line: { dash: 'dash', color: '#9ca3af', width: 1.5 },
        showlegend: false, hoverinfo: 'skip'
      };
    });

    return [...traces, ...curvas];
  };

  // --- LÓGICA DO PLOTLY PARA GHE (k vs Phi com 10 Curvas e Pontos Sincronizados) ---
  const montarDadosGhePlotly = () => {

    const nomes_ghe_local = ['N.C', 'GHE 01', 'GHE 02', 'GHE 03', 'GHE 04', 'GHE 05', 'GHE 06', 'GHE 07', 'GHE 08', 'GHE 09', 'GHE 10'];
    const cores_paleta = ['#9ca3af', '#e11d48', '#ea580c', '#d97706', '#65a30d', '#16a34a', '#059669', '#0891b2', '#2563eb', '#4f46e5', '#475569'];

    // 1. Plotagem dos dados reais (Pontos coloridos de acordo com o FZI)
    const traces = nomes_ghe_local.map((classe, index) => {
      const dadosFiltrados = chartData.filter(d => {
        const poro = Number(d.Porosidade || d[eixoX] || 0);
        const perm = Number(d.Permeabilidade || d[eixoY] || 0);
        return d.Classe_GHE === classe && poro > 0 && perm > 0;
      });
      return {
        x: dadosFiltrados.map(d => Number(d.Porosidade || d[eixoX] || 0)),
        y: dadosFiltrados.map(d => Number(d.Permeabilidade || d[eixoY] || 0)),
        text: dadosFiltrados.map(d => `FZI: ${d.FZI ? d.FZI.toFixed(3) : 'N/A'}`),
        mode: 'markers',
        type: 'scatter',
        name: classe, // Isso fará a legenda dos pontos aparecer certinha
        marker: { color: coresGhe[classe] || cores_paleta[index], size: 7, opacity: hoveredClass ? (classe === hoveredClass ? 1.0 : 0.15) : 0.8, line: { color: 'white', width: 0.5 } }, // Borda branca fina para destaque
        hovertemplate: `<b>${classe}</b><br>Φ: %{x:.2f}<br>K: %{y:.2e} mD<br>%{text}<extra></extra>`
      };
    }).filter(trace => trace.x.length > 0);

    // 2. Montagem das 10 Curvas Teóricas do GHE (Linhas de referência de Corbett)
    const fzi_valores = [0.0938, 0.1875, 0.375, 0.75, 1.5, 3.0, 6.0, 12.0, 24.0, 48.0];

    const curvas = fzi_valores.map((fzi, index) => {
      const x_vals = [];
      const y_vals = [];

      for (let p = 0.01; p <= 0.40; p += 0.01) {
        x_vals.push(p);
        const termo = (fzi * (p / (1 - p))) / 0.0314;
        const k = p * Math.pow(termo, 2);
        y_vals.push(k);
      }

      return {
        x: x_vals,
        y: y_vals,
        mode: 'lines',
        type: 'scatter',
        name: `Limite ${nomes_ghe_local[index + 1]}`,
        line: { width: 1.0, color: cores_paleta[index + 1] }, // Corresponde à cor da classe que começa ali
        showlegend: false, 
        hoverinfo: 'skip'
      };
    });

    return [...traces, ...curvas];
  };

  // Animação de rolagem super suave em Javascript para um tempo maior
  const handleScrollToApp = () => {
    const container = document.getElementById('main-scroll-container');
    const target = document.getElementById('app-section');
    if (!container || !target) return;

    // Desativa o scroll-snap temporariamente para não interromper a animação suave
    container.style.scrollSnapType = 'none';

    const start = container.scrollTop;
    const end = target.offsetTop;
    const distance = end - start;
    const duration = 1500; // 1.5 segundos (mais lento e dramático)
    let startTime: number | null = null;

    // Função de aceleração Cúbica (começa devagar, acelera no meio, freia no fim)
    const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const animation = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      
      container.scrollTo(0, start + distance * easeInOutCubic(progress));

      if (timeElapsed < duration) {
        requestAnimationFrame(animation);
      } else {
        // Reativa o scroll-snap após a animação
        container.style.scrollSnapType = 'y proximity';
      }
    };

    requestAnimationFrame(animation);
  };

  // Referência para manipular a opacidade da tela inicial
  const heroContentRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (heroContentRef.current) {
      const scrollTop = e.currentTarget.scrollTop;
      const windowHeight = window.innerHeight;
      
      // Desaparece conforme rola a primeira tela
      const rawOpacity = 1 - (scrollTop / windowHeight) * 1.5;
      const opacity = Math.max(0, Math.min(1, rawOpacity));
      
      const scale = Math.max(0.95, 1 - (scrollTop / windowHeight) * 0.05);

      heroContentRef.current.style.opacity = opacity.toString();
      heroContentRef.current.style.transform = `scale(${scale})`;
      
      // Desiste de tentar capturar cliques se estiver invisível
      heroContentRef.current.style.pointerEvents = opacity < 0.1 ? 'none' : 'auto';
    }
  };

  return (
    // Esta é a div mestre que abraça tudo (agora sem forçar o snap de forma dura)
    <div 
      id="main-scroll-container" 
      className="h-screen overflow-y-scroll snap-y snap-proximity scroll-smooth bg-[#0B1120] font-sans relative"
      onScroll={handleScroll}
    >
      
      {/* Mesh Gradients Globais que afetam toda a página para dar a sensação de continuidade translúcida */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* ========================================== */}
      {/* 1. TELA INICIAL (HERO SECTION)             */}
      {/* ========================================== */}
      {/* O container externo marca o espaço no scroll, o interno fica sticky no topo */}
      <div className="snap-start relative h-[100vh] shrink-0 z-0">
        <div 
          ref={heroContentRef}
          className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden"
          style={{ willChange: 'opacity, transform' }}
        >
        
        {/* Gradiente sutil em vez de cor sólida para uma mistura suave da primeira pra segunda tela */}
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-[#0B1120]/60 to-[#0B1120]"></div>

        {/* Efeito Glassmorphism em todo o Hero Content para ficar "translúcido" e chique */}
        <div className="relative z-10 flex flex-col items-center text-center px-12 py-16 max-w-4xl bg-white/[0.02] backdrop-blur-md border border-white/5 rounded-[40px] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] transition-transform duration-700 hover:scale-[1.01] hover:bg-white/[0.03]">
          
          {/* LOGO ANIMADA COM ANÉIS DE NEON E EFEITOS GLASS */}
          <div className="relative mb-10 group perspective-1000">
            {/* 1. Aura de Fundo (Breathing Glow) */}
            <div className="absolute -inset-10 bg-blue-500/10 rounded-full blur-[80px] animate-pulse-glow pointer-events-none"></div>
            
            {/* 2. Anéis de Energia (Dual Orbit) */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-blue-600/40 via-cyan-400/20 to-emerald-500/40 rounded-[2.5rem] blur-xl opacity-40 group-hover:opacity-90 transition-all duration-700 animate-[spin_12s_linear_infinite]"></div>
            <div className="absolute -inset-2 bg-gradient-to-bl from-indigo-500/30 via-sky-400/20 to-teal-400/30 rounded-[2.2rem] blur-lg opacity-30 group-hover:opacity-80 transition-all duration-1000 animate-[spin_8s_linear_infinite_reverse]"></div>
            
            {/* 3. Cápsula de borda fina (Glassmorphism avançado) */}
            <div className="relative bg-[#0B1120]/60 backdrop-blur-2xl p-1 rounded-[2.1rem] shadow-2xl border border-white/10 group-hover:border-blue-400/40 transition-all duration-500 overflow-hidden transform group-hover:scale-[1.05] group-hover:shadow-[0_0_50px_rgba(59,130,246,0.4)]">
              
              {/* Efeito de Reflexo (luz varrendo) */}
              <div className="absolute inset-0 translate-x-[-150%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:animate-shine z-20 pointer-events-none"></div>

              <img 
                src="roncore-logo-v8.png" 
                alt="Logo RonCore Analytics" 
                className="w-32 h-32 md:w-44 md:h-44 object-cover rounded-[2rem] relative z-10 border border-white/5 transform transition-transform duration-1000 group-hover:rotate-[2deg]" 
              />
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-6 drop-shadow-2xl">
            RonCore <span className="bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">Analytics</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-300 font-light mb-16 max-w-2xl leading-relaxed opacity-90">
            Automação avançada para caracterização de reservatórios carbonáticos v2. 
            Análise de perfis, classificação de Lucia e identificação de Unidades de Fluxo em segundos.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-12">
            <button 
              onClick={handleScrollToApp}
              className="group flex flex-col items-center gap-4 text-slate-400 hover:text-white transition-all duration-300"
            >
              <span className="text-xs uppercase tracking-[0.4em] font-bold opacity-60 group-hover:opacity-100 transition-opacity">
                Iniciar Análise
              </span>
              <div className="p-4 bg-white/5 rounded-full border border-white/10 group-hover:bg-white/10 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all">
                <svg className="w-6 h-6 animate-bounce text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </button>

            {/* Botão de Instalação (Removido para versão Electron) */}
          </div>
        </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 2. O APLICATIVO REAL                       */}
      {/* ========================================== */}
      <div id="app-section" className="snap-start min-h-screen relative flex flex-col items-center py-10 px-4 overflow-hidden text-slate-200 shrink-0 bg-transparent z-10">
        
        {/* Usando painel mais transparente para fundir melhor com a fluidez master */}
        <div className={`w-full bg-[#131b2f]/60 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-slate-700/50 p-8 relative z-10 ${step === 3 ? 'max-w-5xl' : (step === 1 ? 'max-w-3xl' : 'max-w-md')} transition-all duration-500 animate-fade-in`}>

        {/* MENU DE ABAS MÁGICO (PILL) */}
        <div className="flex justify-center mb-10 w-full relative z-20">
          <div className="relative flex rounded-full bg-[#0f172a]/80 backdrop-blur-md p-1 border border-slate-700/60 shadow-inner overflow-hidden max-w-[400px] w-full">
            {/* Bolha Neon de Fundo que Desliza */}
            <div 
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-transform duration-500 ease-out z-0
              ${abaAtiva === 'lucia' 
                ? 'translate-x-0 bg-gradient-to-r from-blue-600/80 to-blue-400/80 shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                : 'translate-x-[calc(100%+8px)] bg-gradient-to-r from-emerald-600/80 to-emerald-400/80 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
              }`}
            ></div>
            
            <button
              onClick={() => setAbaAtiva('lucia')}
              className={`relative z-10 flex-1 py-2.5 text-sm font-bold tracking-wide transition-colors duration-300 ${abaAtiva === 'lucia' ? 'text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Método de Lucia
            </button>
            <button
              onClick={() => setAbaAtiva('ghe')}
              className={`relative z-10 flex-1 py-2.5 text-sm font-bold tracking-wide transition-colors duration-300 ${abaAtiva === 'ghe' ? 'text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Método GHE (FZI)
            </button>
          </div>
        </div>

        {/* ALERTA DE ERRO */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-900/30 border-l-4 border-rose-500 rounded-md flex items-start">
            <div className="flex-shrink-0">
              <span className="text-rose-500 text-xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-rose-300">Atenção aos Dados</h3>
              <p className="text-sm text-rose-200 mt-1">{errorMsg}</p>
              <button
                onClick={() => setErrorMsg(null)}
                className="mt-2 text-xs font-semibold text-rose-400 hover:text-rose-300"
              >
                Fechar aviso
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-8 mt-2 animate-slide-up">
            {/* Upload Area */}
            <label
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={(e) => {
                if (window.electronAPI) {
                  e.preventDefault();
                  handleNativeUpload();
                }
              }}
              className="border-2 border-dashed border-blue-500/40 rounded-2xl p-12 flex flex-col items-center cursor-pointer bg-slate-800/40 backdrop-blur-md hover:bg-slate-800/60 hover:border-blue-400 hover:shadow-lg transition-all duration-300 group"
            >
              <input type="file" onChange={handleFileSelect} accept=".xlsx, .xls" className="hidden" />
              <div className="relative mb-6 group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl scale-125 group-hover:bg-blue-400/40 transition-colors"></div>
                <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-[0_8px_30px_rgb(0,0,0,0.5)] group-hover:border-blue-500/50 group-hover:shadow-[0_0_40px_rgba(59,130,246,0.3)] transition-all">
                  {/* Ícone de Documento (Lembra a Planilha verde) */}
                  <svg className="h-10 w-10 text-emerald-400 transition-transform duration-500 group-hover:-translate-y-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {/* Ícone de Upload flutuante */}
                  <div className="absolute -bottom-2 -right-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-400 shadow-[0_4px_15px_rgba(59,130,246,0.5)] transition-all duration-300 group-hover:-translate-y-1">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                </div>
              </div>
              <p className="text-xl font-medium text-slate-200 text-center">Arraste sua planilha Excel aqui</p>
              <p className="text-sm text-slate-400 mt-2 font-medium">ou clique para selecionar o arquivo</p>
            </label>

            {/* Opção para abrir pastas especificamente (apenas se estiver no Electron) */}
            {window.electronAPI && (
              <button 
                onClick={async () => {
                  const path = await window.electronAPI?.openFolderDialog();
                  if (path) alert(`Pasta selecionada: ${path}. No momento, o app processa arquivos individualmente, mas agora você consegue navegar pelas suas pastas normalmente.`);
                }}
                className="mt-[-20px] mb-4 text-xs text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1 opacity-60 hover:opacity-100 transition-all font-semibold"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                Não está achando o arquivo? Clique aqui para navegar pelas pastas
              </button>
            )}

            {/* ========================================== */}
            {/* ÁREA DOS FUNDAMENTOS MATEMÁTICOS           */}
            {/* ========================================== */}

            {abaAtiva === 'lucia' ? (
              <div className="mb-8 animate-slide-up-delayed">
                <div className="bg-slate-900/40 backdrop-blur-md rounded-3xl p-6 border border-slate-700 shadow-sm relative overflow-hidden">

                  <h2 className="text-lg font-bold text-slate-200 mb-5 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                    Fundamento Matemático <span className="text-sm font-normal text-slate-400 ml-2 border-l border-slate-600 pl-2">Jennings & Lucia, 2003</span>
                  </h2>

                  <div className="grid grid-cols-1 gap-5">
                    {/* RFN Equation */}
                    <div className="bg-slate-800/60 backdrop-blur-sm p-5 rounded-2xl shadow-sm border border-slate-600/50 hover-lift">
                      <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Cálculo do Rock Fabric Number (RFN)</h3>
                      <div className="bg-slate-800 rounded-lg p-6 text-white shadow-inner border border-gray-700 overflow-x-auto custom-scrollbar">
                        <div className="flex flex-col lg:flex-row lg:justify-center items-center gap-6 lg:gap-10 min-w-max px-4 font-sans">
                          {/* Equação RFN */}
                          <div className="flex flex-col items-center">
                            <span className="mb-2 text-cyan-300 text-[10px] font-sans uppercase tracking-tight font-medium">1. Global Equation</span>
                            <div className="flex items-center gap-3 bg-slate-700/30 px-6 py-4 rounded-2xl border border-cyan-500/20 whitespace-nowrap shadow-md">
                              <span className="font-bold text-cyan-400 text-xl">log(RFN) =</span>
                              <div className="flex flex-col items-center leading-none">
                                <span className="border-b-2 border-cyan-400/30 px-3 mb-1 font-bold text-white text-lg">A + C × log(Φ) - log(k)</span>
                                <span className="pt-1 font-bold text-white text-lg">B + D × log(Φ)</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Constants Bubble */}
                      <div className="mt-4 flex flex-wrap justify-center gap-3 text-[11px] font-sans">
                        <span className="bg-slate-900/60 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 font-bold shadow-sm hover:border-cyan-500/50 transition-colors">A = 9.7982</span>
                        <span className="bg-slate-900/60 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 font-bold shadow-sm hover:border-cyan-500/50 transition-colors">B = 12.0803</span>
                        <span className="bg-slate-900/60 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 font-bold shadow-sm hover:border-cyan-500/50 transition-colors">C = 8.6711</span>
                        <span className="bg-slate-900/60 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 font-bold shadow-sm hover:border-cyan-500/50 transition-colors">D = 8.2965</span>
                      </div>
                    </div>

                    {/* Classification Criteria */}
                    <div className="bg-slate-800/60 backdrop-blur-sm p-5 rounded-2xl shadow-sm border border-slate-600/50 hover-lift">
                      <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider text-center">Critérios de Classificação</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-slate-900/60 backdrop-blur-md text-cyan-300 p-3 rounded-xl text-center border border-cyan-500/30 shadow-sm hover:scale-[1.02] transition-transform">
                          <div className="font-bold text-xs mb-1">0.5 ≤ RFN ≤ 1.5</div>
                          <div className="text-[10px] font-mono bg-cyan-500/20 py-1 rounded inline-block px-2 uppercase font-bold text-cyan-400">Classe 1</div>
                        </div>
                        <div className="bg-slate-900/60 backdrop-blur-md text-emerald-300 p-3 rounded-xl text-center border border-emerald-500/30 shadow-sm hover:scale-[1.02] transition-transform">
                          <div className="font-bold text-xs mb-1">1.5 &lt; RFN ≤ 2.5</div>
                          <div className="text-[10px] font-mono bg-emerald-500/20 py-1 rounded inline-block px-2 uppercase font-bold text-emerald-400">Classe 2</div>
                        </div>
                        <div className="bg-slate-900/60 backdrop-blur-md text-rose-300 p-3 rounded-xl text-center border border-rose-500/30 shadow-sm hover:scale-[1.02] transition-transform">
                          <div className="font-bold text-xs mb-1">2.5 &lt; RFN ≤ 4.0</div>
                          <div className="text-[10px] font-mono bg-rose-500/20 py-1 rounded inline-block px-2 uppercase font-bold text-rose-400">Classe 3</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/40 backdrop-blur-md rounded-3xl p-6 border border-slate-700 shadow-sm relative overflow-hidden mb-8 animate-slide-up-delayed">

                <h2 className="text-lg font-bold text-slate-200 mb-5 flex items-center">
                  <svg className="w-6 h-6 mr-2 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                  Fundamento Matemático <span className="text-sm font-normal text-slate-400 ml-2 border-l border-slate-600 pl-2">Amaefule et al., 1993</span>
                </h2>

                <div className="grid grid-cols-1 gap-5">
                  {/* GHE Equations */}
                  <div className="bg-slate-800/60 backdrop-blur-sm p-5 rounded-2xl shadow-sm border border-slate-600/50 hover-lift">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Cálculo do Flow Zone Indicator (FZI)</h3>
                    <div className="bg-slate-800 rounded-lg p-6 text-white shadow-inner border border-gray-700 overflow-x-auto custom-scrollbar">
                      <div className="flex flex-col lg:flex-row lg:justify-center items-center gap-6 lg:gap-10 min-w-max px-4 font-sans">
                        {/* Equação RQI */}
                        <div className="flex flex-col items-center">
                          <span className="mb-2 text-blue-300 text-[10px] font-sans uppercase tracking-tight font-medium">1. Reservoir Quality Index</span>
                          <div className="flex items-center gap-2 bg-slate-700/50 px-5 py-3 rounded-xl whitespace-nowrap shadow-sm">
                            <span className="font-bold text-emerald-400 text-lg">RQI =</span>
                            <span className="font-bold text-white text-lg">0.0314 × √(k / Φ)</span>
                          </div>
                        </div>

                        <span className="text-slate-600 hidden lg:block text-3xl font-light">➔</span>

                        {/* Equação Phi_z */}
                        <div className="flex flex-col items-center">
                          <span className="mb-2 text-emerald-300 text-[10px] font-sans uppercase tracking-tight font-medium">2. Pore-to-Matrix Ratio</span>
                          <div className="flex items-center gap-2 bg-slate-700/50 px-5 py-3 rounded-xl whitespace-nowrap shadow-sm">
                            <span className="font-bold text-emerald-400 text-lg">Φz =</span>
                            <div className="flex flex-col items-center leading-none">
                              <span className="border-b-2 border-slate-500/80 px-3 mb-1 font-bold text-white text-lg">Φ</span>
                              <span className="font-bold text-white text-lg">1 - Φ</span>
                            </div>
                          </div>
                        </div>

                        <span className="text-slate-500 hidden lg:block text-2xl">➔</span>

                        {/* Equação FZI */}
                        <div className="flex flex-col items-center">
                          <span className="mb-2 text-yellow-300 text-[10px] font-sans uppercase tracking-tight font-medium">3. Flow Zone Indicator</span>
                          <div className="flex items-center gap-3 bg-slate-700/30 px-6 py-4 rounded-2xl border border-yellow-500/20 whitespace-nowrap shadow-md">
                            <span className="font-bold text-yellow-400 text-xl">FZI =</span>
                            <div className="flex flex-col items-center leading-none">
                              <span className="border-b-2 border-yellow-400/30 px-3 mb-1 font-bold text-white text-xl">RQI</span>
                              <span className="font-bold text-yellow-400 text-xl">Φz</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* GHE Classification Criteria */}
                  <div className="bg-slate-800/60 backdrop-blur-sm p-5 rounded-2xl shadow-sm border border-slate-600/50 hover-lift">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider text-center">Unidades de Fluxo (Hydraulic Flow Units)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-slate-900/60 backdrop-blur-md text-rose-300 p-3 rounded-xl text-center border border-rose-500/30 shadow-sm hover:scale-[1.02] transition-transform">
                        <div className="font-bold text-xs mb-1">FZI &lt; 0.5</div>
                        <div className="text-[10px] font-mono bg-rose-500/20 py-1 rounded inline-block px-2 uppercase font-bold text-rose-400">GHE Ruim</div>
                      </div>
                      <div className="bg-slate-900/60 backdrop-blur-md text-amber-300 p-3 rounded-xl text-center border border-amber-500/30 shadow-sm hover:scale-[1.02] transition-transform">
                        <div className="font-bold text-xs mb-1">0.5 ≤ FZI ≤ 2.0</div>
                        <div className="text-[10px] font-mono bg-amber-500/20 py-1 rounded inline-block px-2 uppercase font-bold text-amber-400">GHE Médio</div>
                      </div>
                      <div className="bg-slate-900/60 backdrop-blur-md text-emerald-300 p-3 rounded-xl text-center border border-emerald-500/30 shadow-sm hover:scale-[1.02] transition-transform">
                        <div className="font-bold text-xs mb-1">2.0 &lt; FZI ≤ 5.0</div>
                        <div className="text-[10px] font-mono bg-emerald-500/20 py-1 rounded inline-block px-2 uppercase font-bold text-emerald-400">GHE Bom</div>
                      </div>
                      <div className="bg-slate-900/60 backdrop-blur-md text-cyan-300 p-3 rounded-xl text-center border border-cyan-500/30 shadow-sm hover:scale-[1.02] transition-transform">
                        <div className="font-bold text-xs mb-1">FZI &gt; 5.0</div>
                        <div className="text-[10px] font-mono bg-cyan-500/20 py-1 rounded inline-block px-2 uppercase font-bold text-cyan-400">GHE Excelente</div>
                      </div>
                    </div>
                    <p className="text-[10px] text-center text-slate-500 mt-4 italic leading-tight">
                      O espaço poroso é subdividido em 10 classes logarítmicas (GHE 01 a GHE 10) baseadas nos intervalos contínuos de FZI.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-slide-up">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1 font-sans">Porosidade (Φ)</label>
              <select className="w-full bg-slate-800/80 border border-slate-600 text-slate-200 rounded-md p-2" value={poroCol} onChange={(e) => setPoroCol(e.target.value)}>
                <option value="nenhum">Nenhum</option> {columns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1 font-sans">Permeabilidade (k)</label>
              <select className="w-full bg-slate-800/80 border border-slate-600 text-slate-200 rounded-md p-2" value={permCol} onChange={(e) => setPermCol(e.target.value)}>
                <option value="nenhum">Nenhum</option> {columns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
            </div>
            <button onClick={handleClassificar} disabled={isProcessing} className={`w-full py-3 px-4 rounded-lg shadow-md text-white font-semibold transform transition-all duration-300 focus:outline-none mt-4 flex justify-center items-center overflow-hidden relative ${isProcessing ? 'bg-slate-800 border border-slate-700' : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 hover:-translate-y-0.5 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900'}`}>
              {isProcessing ? (
                <div className="flex items-center">
                  <div className="w-48 h-1.5 bg-slate-700 rounded-full overflow-hidden mr-4 relative">
                    <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-blue-500 to-emerald-400 w-1/2 rounded-full animate-[ping_1.5s_ease-in-out_infinite] opacity-50"></div>
                    <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-blue-400 to-emerald-300 w-1/2 rounded-full animate-bounce" style={{animationDuration: '0.8s'}}></div>
                  </div>
                  <span className="text-slate-300 text-sm animate-pulse tracking-widest font-mono font-bold textShadow">SCANNING...</span>
                </div>
              ) : 'Processar e Gerar Gráfico'}
            </button>
            <button onClick={handleReset} className="w-full py-3 px-4 rounded-xl border border-slate-600 text-slate-300 font-semibold bg-slate-800/50 backdrop-blur-md hover:bg-slate-700/80 transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900 mt-2 shadow-sm">Cancelar</button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-300 mb-1">Eixo X</label>
                <select className="w-full bg-slate-800/80 border border-slate-600 text-slate-200 rounded-md p-2" value={eixoX} onChange={(e) => setEixoX(e.target.value)}>
                  <option value="nenhum">Nenhum</option> {columns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-300 mb-1">Eixo Y</label>
                <select className="w-full bg-slate-800/80 border border-slate-600 text-slate-200 rounded-md p-2" value={eixoY} onChange={(e) => setEixoY(e.target.value)}>
                  <option value="nenhum">Nenhum</option> {columns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>
              <div className="sm:w-48">
                <label className="block text-sm font-medium text-slate-300 mb-1">Tema do Gráfico</label>
                <div className="flex items-center justify-center sm:justify-start bg-slate-800/80 border border-slate-600 rounded-md p-1 h-[42px]">
                  <button onClick={() => setChartTheme('dark')} className={`flex-1 py-1 text-xs font-semibold rounded ${chartTheme === 'dark' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Escuro</button>
                  <button onClick={() => setChartTheme('light')} className={`flex-1 py-1 text-xs font-semibold rounded ${chartTheme === 'light' ? 'bg-slate-200 text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Claro</button>
                </div>
              </div>
            </div>
            <div className="w-full grid grid-cols-1 xl:grid-cols-3 gap-6 relative">
              <div className="col-span-1 xl:col-span-2 flex flex-col gap-6">

              {/* CHAVEADOR DE ABAS */}
              {abaAtiva === 'lucia' ? (

                <div className="flex flex-col lg:flex-row gap-6">
                  {/* GRÁFICO 1: PLOTLY (Interativo, Zoom nativo, Curvas Semi-Log) */}
                  <div className={`w-full rounded-2xl p-2 h-[500px] transition-all duration-500 shadow-sm z-10 ${chartTheme === 'dark' ? 'bg-[#0a0f1c] relative border border-transparent [background-clip:padding-box] before:absolute before:inset-0 before:-z-10 before:rounded-2xl before:m-[-1px] before:bg-gradient-to-br before:from-blue-500/60 before:via-slate-800 before:to-emerald-500/60' : 'bg-white border border-slate-300'}`}>
                    <h3 className={`text-center text-sm font-semibold mb-1 mt-2 ${chartTheme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Linear vs Log (Interativo com Zoom)</h3>
                    {eixoX !== 'nenhum' && eixoY !== 'nenhum' ? (
                      <Plot
                        data={montarDadosPlotly() as any}
                        useResizeHandler={true}
                        style={{ width: '100%', height: '90%' }}
                        layout={{
                          autosize: true,
                          margin: { t: 10, r: 20, b: 80, l: 80 },
                          hovermode: 'closest',
                          xaxis: {
                            title: { text: eixoX },
                            type: 'log',
                            range: [-2, Math.log10(0.5)], // O Plotly usa o expoente diretamente
                            gridcolor: chartTheme === 'dark' ? '#1e293b' : '#e5e7eb',
                            zerolinecolor: chartTheme === 'dark' ? '#334155' : '#9ca3af',
                            tickformat: '.1e', // Força notação cientifica
                            exponentformat: 'power', // Transforma e-01 em 10^-1
                            dtick: 1 // Garante que as marcações principais cresçam de 1 em 1 log (ou seja, 10x)
                          },
                          yaxis: {
                            title: { text: eixoY, standoff: 15 }, type: 'log',
                            range: [-7, 8], // O Plotly usa o expoente diretamente quando type='log'
                            gridcolor: chartTheme === 'dark' ? '#1e293b' : '#e5e7eb',
                            zerolinecolor: chartTheme === 'dark' ? '#334155' : '#9ca3af',
                            tickformat: '.1e',
                            exponentformat: 'power',
                            dtick: 1
                          },
                          plot_bgcolor: chartTheme === 'dark' ? '#0B1120' : '#ffffff',
                          paper_bgcolor: chartTheme === 'dark' ? '#0B1120' : '#ffffff',
                          font: { color: chartTheme === 'dark' ? '#cbd5e1' : '#374151' },
                          legend: { orientation: 'h', y: -0.25 }
                        }}
                        config={{
                          displaylogo: false,
                          modeBarButtonsToRemove: ['lasso2d', 'select2d'],
                          toImageButtonOptions: {
                            format: 'png',
                            filename: `Grafico_Lucia_${chartTheme}`,
                            height: 600,
                            width: 1000,
                            scale: 2
                          }
                        }}
                      />
                    ) : null}
                  </div>
                </div>

              ) : (

                <div className="flex flex-col gap-6">
                  {/* GRÁFICO GHE: k vs Porosidade com 10 Curvas */}
                  <div className={`w-full rounded-2xl p-4 h-[600px] transition-all duration-500 shadow-sm z-10 ${chartTheme === 'dark' ? 'bg-[#0a0f1c] relative border border-transparent [background-clip:padding-box] before:absolute before:inset-0 before:-z-10 before:rounded-2xl before:m-[-1px] before:bg-gradient-to-br before:from-emerald-500/60 before:via-slate-800 before:to-blue-500/60' : 'bg-white border border-slate-300'}`}>
                    <h3 className={`text-center text-sm font-semibold mb-2 mt-2 ${chartTheme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      Método GHE: Permeabilidade vs Porosidade (Amaefule et al., 1993)
                    </h3>
                    {eixoX !== 'nenhum' && eixoY !== 'nenhum' ? (
                      <Plot
                        data={montarDadosGhePlotly() as any}
                        useResizeHandler={true}
                        style={{ width: '100%', height: '90%' }}
                        layout={{
                          autosize: true,
                          margin: { t: 10, r: 20, b: 80, l: 80 },
                          hovermode: 'closest',
                          xaxis: {
                            title: { text: eixoX },
                            type: 'linear', // O eixo X é linear (Porosidade)
                            gridcolor: chartTheme === 'dark' ? '#1e293b' : '#e5e7eb',
                            zerolinecolor: chartTheme === 'dark' ? '#334155' : '#9ca3af',
                            range: [0, 0.4] // Limita até 40% de porosidade para as curvas ficarem bonitas
                          },
                          yaxis: {
                            title: { text: eixoY, standoff: 15 },
                            type: 'log',    // O eixo Y é log (Permeabilidade)
                            range: [-7, 8], // Mesma range do Lucia para consistência
                            gridcolor: chartTheme === 'dark' ? '#1e293b' : '#e5e7eb',
                            zerolinecolor: chartTheme === 'dark' ? '#334155' : '#9ca3af',
                            tickformat: '.1e', exponentformat: 'power',
                            dtick: 1
                          },
                          plot_bgcolor: chartTheme === 'dark' ? '#0B1120' : '#ffffff',
                          paper_bgcolor: chartTheme === 'dark' ? '#0B1120' : '#ffffff',
                          font: { color: chartTheme === 'dark' ? '#ffffff' : '#374151' },
                          hoverlabel: { font: { color: chartTheme === 'dark' ? '#ffffff' : '#111827' } },
                          legend: { orientation: 'h', y: -0.25 } // Legenda horizontal embaixo
                        }}
                        config={{
                          displaylogo: false,
                          modeBarButtonsToRemove: ['lasso2d', 'select2d'],
                          toImageButtonOptions: {
                            format: 'png',
                            filename: `Grafico_GHE_${chartTheme}`,
                            height: 600,
                            width: 1000,
                            scale: 2
                          }
                        }}
                      />
                    ) : null}
                  </div>
                </div>

              )}
              </div>

              {/* === ROCK CORE 3D TILE === */}
              {chartData.length > 0 && (
                <div className={`col-span-1 rounded-2xl p-4 h-[500px] xl:h-auto min-h-[400px] transition-all duration-500 shadow-sm flex flex-col relative z-20 ${chartTheme === 'dark' ? 'bg-[#0a0f1c] border border-slate-700/50' : 'bg-white border border-slate-300'}`}>
                  <h3 className={`text-center text-sm font-bold mb-2 ${chartTheme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    Testemunho de Rocha (Simulação 3D)
                  </h3>
                  <div className="flex-1 w-full relative group">
                     {/* Bedge com a Classe Predominante */}
                     <p className="absolute top-2 right-2 z-10 text-[10px] px-2 py-1 rounded font-bold uppercase shadow-lg backdrop-blur-sm" 
                        style={{ color: getCorClasse(dominantClass), backgroundColor: `${getCorClasse(dominantClass)}20`, border: `1px solid ${getCorClasse(dominantClass)}40` }}>
                       Predominante: {dominantClass}
                     </p>
                     <div className="absolute inset-0 cursor-grab active:cursor-grabbing">
                        <RockCore3D dominantClass={dominantClass} theme={chartTheme} />
                     </div>
                     <p className="absolute bottom-2 left-0 right-0 text-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity" style={{color: chartTheme === 'dark' ? '#94a3b8' : '#64748b'}}>
                       Arraste para girar a rocha
                     </p>
                  </div>
                </div>
              )}

              {/* === NOVOS GRÁFICOS RECHARTS NEON === */}
              {chartData.length > 0 && eixoX !== 'nenhum' && eixoY !== 'nenhum' && (
                <div className="col-span-1 xl:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 mt-2 animate-slide-up-delayed">
                  {/* Gráfico de Distribuição (BarChart) */}
                  <div className={`w-full rounded-2xl p-4 h-[350px] transition-all duration-500 shadow-sm flex flex-col items-center z-10 ${chartTheme === 'dark' ? 'bg-[#0a0f1c] relative border border-transparent [background-clip:padding-box] before:absolute before:inset-0 before:-z-10 before:rounded-2xl before:m-[-1px] before:bg-gradient-to-br before:from-purple-500/40 before:to-blue-500/40' : 'bg-white border border-slate-300'}`}>
                    <h3 className={`text-center text-sm font-bold mb-4 ${chartTheme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      Distribuição de Amostras
                    </h3>
                    <ResponsiveContainer width="100%" height="90%">
                      <BarChart data={distribuicaoData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme === 'dark' ? '#1e293b' : '#e5e7eb'} vertical={false} />
                        <XAxis dataKey="nome" stroke={chartTheme === 'dark' ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke={chartTheme === 'dark' ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                          cursor={{ fill: chartTheme === 'dark' ? '#1e293b' : '#f1f5f9' }}
                          contentStyle={{ backgroundColor: chartTheme === 'dark' ? '#0f172a' : '#ffffff', borderColor: chartTheme === 'dark' ? '#334155' : '#e2e8f0', borderRadius: '8px' }}
                          itemStyle={{ color: chartTheme === 'dark' ? '#ffffff' : '#111827' }}
                          labelStyle={{ color: chartTheme === 'dark' ? '#ffffff' : '#111827' }}
                        />
                        <Bar dataKey="quantidade" radius={[4, 4, 0, 0]}>
                          {distribuicaoData.map((entry, index) => {
                            const isFaded = hoveredClass && hoveredClass !== entry.nome;
                            return (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.fill} 
                                style={{ 
                                  filter: chartTheme === 'dark' && !isFaded ? `drop-shadow(0 0 8px ${entry.fill})` : 'none',
                                  opacity: isFaded ? 0.2 : 1.0,
                                  transition: 'opacity 0.3s ease'
                                }} 
                                onMouseEnter={() => setHoveredClass(entry.nome)}
                                onMouseLeave={() => setHoveredClass(null)}
                              />
                            );
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-4 mt-2 mb-2 w-full">
                      {currentLegendPayload.map((item, i) => {
                        const isFaded = hoveredClass && hoveredClass !== item.value;
                        return (
                          <div 
                            key={i} 
                            className="flex items-center text-xs font-semibold cursor-pointer transition-opacity duration-300" 
                            style={{ color: chartTheme === 'dark' ? '#ffffff' : '#475569', opacity: isFaded ? 0.3 : 1.0 }}
                            onMouseEnter={() => setHoveredClass(item.value)}
                            onMouseLeave={() => setHoveredClass(null)}
                          >
                            <span className="w-3 h-3 rounded-full mr-2 inline-block transition-all" style={{ backgroundColor: item.color, boxShadow: chartTheme === 'dark' && !isFaded ? `0 0 6px ${item.color}` : 'none' }}></span>
                            {item.value}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Gráfico de Dispersão (ScatterChart) */}
                  <div className={`w-full rounded-2xl p-4 h-[350px] transition-all duration-500 shadow-sm flex flex-col items-center z-10 ${chartTheme === 'dark' ? 'bg-[#0a0f1c] relative border border-transparent [background-clip:padding-box] before:absolute before:inset-0 before:-z-10 before:rounded-2xl before:m-[-1px] before:bg-gradient-to-br before:from-indigo-500/40 before:to-emerald-500/40' : 'bg-white border border-slate-300'}`}>
                    <h3 className={`text-center text-sm font-bold mb-4 ${chartTheme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      {abaAtiva === 'lucia' ? 'RFN vs Porosidade' : 'FZI vs Porosidade'}
                    </h3>
                    <ResponsiveContainer width="100%" height="90%">
                      <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme === 'dark' ? '#1e293b' : '#e5e7eb'} />
                        <XAxis type="number" dataKey="poro" name="Porosidade" stroke={chartTheme === 'dark' ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} axisLine={false} domain={['dataMin', 'dataMax']} tickFormatter={(v) => v.toFixed(2)} />
                        <YAxis type="number" dataKey="parametro" name={abaAtiva === 'lucia' ? 'RFN' : 'FZI'} stroke={chartTheme === 'dark' ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} axisLine={false} scale="log" domain={['dataMin', 'dataMax']} allowDataOverflow tickFormatter={(v) => v > 100 ? v.toExponential(1) : v.toFixed(2)} />
                        <ZAxis type="category" dataKey="classe" name="Classe" />
                        <Tooltip
                          cursor={{ strokeDasharray: '3 3' }}
                          contentStyle={{ backgroundColor: chartTheme === 'dark' ? '#0f172a' : '#ffffff', borderColor: chartTheme === 'dark' ? '#334155' : '#e2e8f0', borderRadius: '8px' }}
                          itemStyle={{ color: chartTheme === 'dark' ? '#ffffff' : '#111827' }}
                          labelStyle={{ color: chartTheme === 'dark' ? '#ffffff' : '#111827' }}
                        />
                        <Scatter data={dispersaoData} shape="circle">
                          {dispersaoData.map((entry, index) => {
                            const isFaded = hoveredClass && hoveredClass !== entry.classe;
                            return (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.fill} 
                                style={{ 
                                  filter: chartTheme === 'dark' && !isFaded ? `drop-shadow(0 0 6px ${entry.fill})` : 'none',
                                  opacity: isFaded ? 0.2 : 1.0,
                                  transition: 'opacity 0.3s ease'
                                }} 
                              />
                            );
                          })}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-4 mt-2 mb-2 w-full">
                      {currentLegendPayload.map((item, i) => {
                        const isFaded = hoveredClass && hoveredClass !== item.value;
                        return (
                          <div 
                            key={i} 
                            className="flex items-center text-xs font-semibold cursor-pointer transition-opacity duration-300" 
                            style={{ color: chartTheme === 'dark' ? '#cbd5e1' : '#475569', opacity: isFaded ? 0.3 : 1.0 }}
                            onMouseEnter={() => setHoveredClass(item.value)}
                            onMouseLeave={() => setHoveredClass(null)}
                          >
                            <span className="w-3 h-3 rounded-full mr-2 inline-block transition-all" style={{ backgroundColor: item.color, boxShadow: chartTheme === 'dark' && !isFaded ? `0 0 6px ${item.color}` : 'none' }}></span>
                            {item.value}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* === NOVA DATA TABLE DE AMOSTRAS === */}
              {chartData.length > 0 && (
                <div className="col-span-1 xl:col-span-3 mt-8 animate-slide-up bg-[#0f172a]/80 backdrop-blur-md rounded-2xl border border-slate-700 overflow-hidden shadow-lg z-10 relative">
                  <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center relative">
                    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Amostra de Resultados (Top 15)</h3>
                    <span className="text-xs text-slate-400 font-mono">Total processado: {chartData.length}</span>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-left text-slate-300 min-w-[600px]">
                      <thead className="text-xs text-slate-400 bg-slate-800/80 uppercase">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Id / Ref</th>
                          <th className="px-6 py-3 font-semibold">Porosidade (Φ)</th>
                          <th className="px-6 py-3 font-semibold">Permeabilidade (k)</th>
                          <th className="px-6 py-3 font-semibold">{abaAtiva === 'lucia' ? 'RFN' : 'FZI'}</th>
                          <th className="px-6 py-3 font-semibold text-center">Classificação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {chartData.slice(0, 15).map((row, idx) => {
                          const classeStr = abaAtiva === 'lucia' ? row.Classe_Lucia : row.Classe_GHE;
                          const paramVal = abaAtiva === 'lucia' ? row.RFN_Calculado : row.FZI;
                          return (
                            <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                              <td className="px-6 py-3 font-mono text-xs opacity-70">Linha {idx + 1}</td>
                              <td className="px-6 py-3 font-mono">{(Number(row.Porosidade) * 100).toFixed(2)}%</td>
                              <td className="px-6 py-3 font-mono">{Number(row.Permeabilidade).toExponential(2)}</td>
                              <td className="px-6 py-3 font-mono text-blue-300">{Number(paramVal).toFixed(4)}</td>
                              <td className="px-6 py-3 text-center">
                                <span 
                                  className="px-3 py-1 rounded-full text-xs font-bold shadow-sm inline-block min-w-[80px]"
                                  style={{ 
                                    backgroundColor: `${getCorClasse(classeStr)}30`,
                                    color: getCorClasse(classeStr),
                                    border: `1px solid ${getCorClasse(classeStr)}50` 
                                  }}
                                >
                                  {classeStr}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 mt-8 w-full">
              <div className="flex flex-col sm:flex-row gap-4">
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    download={abaAtiva === 'lucia' ? 'Classificado_Lucia.xlsx' : 'Classificado_GHE.xlsx'}
                    className="flex-1 flex justify-center items-center py-3 px-6 rounded-xl shadow-md text-white font-semibold bg-slate-800 hover:bg-slate-700 transform hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    Baixar Aba Atual
                  </a>
                )}
                <button
                  onClick={baixarRelatorioCompletoOffline}
                  className="flex-1 flex justify-center items-center py-3 px-6 rounded-xl shadow-lg text-white font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transform hover:-translate-y-1 transition-all duration-300"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  Relatório Completo
                </button>
              </div>
              
              <button onClick={handleReset} className="w-full flex justify-center items-center py-3 px-6 rounded-xl shadow-sm border border-slate-600 text-slate-300 font-semibold bg-slate-800/20 backdrop-blur-md hover:bg-slate-700/40 transform hover:-translate-y-0.5 transition-all duration-200">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                Analisar Outro Arquivo
              </button>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* HISTÓRICO DE ANÁLISES RECENTES             */}
        {/* (dentro do app-section para ser visível)   */}
        {/* ========================================== */}
        {historico.length > 0 && (
          <div className="mt-10 bg-slate-800/50 backdrop-blur-md border border-slate-700 p-6 rounded-2xl w-full shadow-xl animate-fade-in">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Análises Recentes
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {historico.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-600 p-4 rounded-xl hover:border-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all group flex flex-col gap-3"
                >
                  {/* Informações do arquivo */}
                  <div>
                    <div className="text-emerald-400 font-semibold truncate group-hover:text-emerald-300">
                      {item.nomeArquivo}
                    </div>
                    <div className="text-slate-400 text-sm mt-1">
                      {item.dataHora}
                    </div>
                    <div className="text-slate-500 text-xs mt-1">
                      {item.dados.length} Amostras
                    </div>
                  </div>

                  {/* Botões de ação */}
                  <div className="flex gap-2 mt-auto">
                    {/* Visualizar nos gráficos */}
                    <button
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-blue-300 hover:text-blue-200 text-xs font-semibold transition-all"
                      onClick={() => {
                        setChartData(item.dados);
                        setStep(3);
                        if (item.dados.length > 0) {
                          setEixoX('Porosidade');
                          setEixoY('Permeabilidade');
                        }
                      }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                      Visualizar
                    </button>

                    {/* Baixar Excel */}
                    <button
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-emerald-900/50 hover:bg-emerald-800/70 text-emerald-400 hover:text-emerald-300 text-xs font-semibold border border-emerald-700/50 hover:border-emerald-500 transition-all"
                      onClick={() => {
                        const ws = XLSX.utils.json_to_sheet(item.dados);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, 'Analise_Completa');
                        const nomeBase = item.nomeArquivo.replace(/\.[^/.]+$/, '');
                        XLSX.writeFile(wb, `${nomeBase}_RonCore.xlsx`);
                      }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                      Baixar Excel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
      {/* Botão Flutuante (Removido para versão Electron) */}
    </div>
    </div>
  );
}

export default App;
