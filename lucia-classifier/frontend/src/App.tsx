import React, { useState, useRef, useEffect, type DragEvent } from 'react';
import axios from 'axios';
import Plot from 'react-plotly.js'; // Importando o Plotly para o gráfico único
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis, CartesianGrid } from 'recharts';

// Quando colocarmos o backend no Render, colaremos o link oficial aqui!
// Por enquanto, deixe o localhost para continuar funcionando no seu computador.
export const API_URL = "http://localhost:8000";

function App() {
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

  // Estado para capturar o evento de instalação do PWA
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("Para instalar:\n\n1. No Chrome/Edge: Clique nos três pontos (⋮) no topo e escolha 'Instalar App'.\n2. No iPhone: Toque no botão de Compartilhar e escolha 'Adicionar à Tela de Início'.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const coresClasses: Record<string, string> = {
    'Classe 1': '#22d3ee', // bg-cyan-400
    'Classe 2': '#34d399', // bg-emerald-400
    'Classe 3': '#fb7185', // bg-rose-400
    'N.C': '#64748b'       // bg-slate-500
  };

  const nomes_ghe = ['GHE 01', 'GHE 02', 'GHE 03', 'GHE 04', 'GHE 05', 'GHE 06', 'GHE 07', 'GHE 08', 'GHE 09', 'GHE 10', 'N.C'];
  const cores_paleta_ghe = ['#e11d48', '#ea580c', '#d97706', '#65a30d', '#16a34a', '#059669', '#0891b2', '#2563eb', '#4f46e5', '#475569', '#9ca3af'];
  const coresGhe: Record<string, string> = {};
  nomes_ghe.forEach((nome, i) => coresGhe[nome] = cores_paleta_ghe[i]);

  const getCorClasse = (classe: string) => {
    if (!classe) return '#64748b';
    if (classe.startsWith('Classe')) return coresClasses[classe] || '#64748b';
    return coresGhe[classe] || '#64748b';
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => e.preventDefault();
  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) await processarUpload(e.dataTransfer.files[0]);
  };
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) await processarUpload(e.target.files[0]);
  };

  const processarUpload = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      alert("Envie apenas arquivos Excel (.xlsx ou .xls)");
      return;
    }
    setFile(selectedFile);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(`/api/colunas`, formData);
      setColumns(response.data.colunas);
      setStep(2);
    } catch (error: any) {
      const mensagem = error.response?.data?.detail || "Ocorreu um erro de conexão com o servidor.";
      setErrorMsg(mensagem);
    }
  };

  const handleClassificar = async () => {
    if (!file || poroCol === 'nenhum' || permCol === 'nenhum') return;
    setIsProcessing(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('col_poro', poroCol);
    formData.append('col_perm', permCol);

    // DEFINE QUAL ROTA CHAMAR COM BASE NA ABA ATIVA
    const rotaApi = abaAtiva === 'lucia' ? '/api/processar' : '/api/processar_ghe';
    try {
      const response = await axios.post(rotaApi, formData);
      const { dados_grafico, arquivo_b64 } = response.data;
      setChartData(dados_grafico); setEixoX(poroCol); setEixoY(permCol);

      const byteCharacters = atob(arquivo_b64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      setDownloadUrl(window.URL.createObjectURL(blob));
      setStep(3);
    } catch (error: any) {
      const mensagem = error.response?.data?.detail || "Ocorreu um erro no processamento.";
      setErrorMsg(mensagem);
    } finally {
      setIsProcessing(false);
    }
  };

  const baixarRelatorioCompleto = async () => {
    if (!file || poroCol === 'nenhum' || permCol === 'nenhum') return;
    setIsProcessing(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("col_poro", poroCol);
    formData.append("col_perm", permCol);

    try {
      const response = await axios.post(`/api/processar_ambos`, formData);
      const { arquivo_b64 } = response.data;

      const byteCharacters = atob(arquivo_b64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "RoFlow_Analise_Completa.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Erro no download completo:", error);
      alert("Houve um erro ao gerar o relatório completo.");
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
    const rawData = chartData.filter(d => d[eixoX] !== undefined && Number(d[eixoX]) > 0).map(d => ({
      poro: Number(d[eixoX]),
      parametro: abaAtiva === 'lucia' ? Number(d.RFN_Calculado) : Number(d.FZI),
      classe: abaAtiva === 'lucia' ? d.Classe_Lucia : d.Classe_GHE,
      fill: getCorClasse(abaAtiva === 'lucia' ? d.Classe_Lucia : d.Classe_GHE)
    }));
    return rawData.filter(d => !isNaN(d.parametro) && d.parametro > 0 && d.classe !== 'N.C');
  };

  const distribuicaoData = chartData.length > 0 ? obterDadosDistribuicao() : [];
  const dispersaoData = chartData.length > 0 ? obterDadosDispersaoSecundaria() : [];

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
      const dadosFiltrados = chartData.filter(d => d.Classe_Lucia === classe && d[eixoX] > 0 && d[eixoY] > 0);
      return {
        x: dadosFiltrados.map(d => d[eixoX]),
        y: dadosFiltrados.map(d => d[eixoY]),
        text: dadosFiltrados.map(d => `RFN: ${d.RFN_Calculado ? d.RFN_Calculado.toFixed(4) : 'N/A'}`),
        mode: 'markers',
        type: 'scatter',
        name: classe,
        marker: { color: coresClasses[classe], size: 7 },
        hovertemplate: `<b>${classe}</b><br>${eixoX}: %{x:.2e}<br>${eixoY}: %{y:.2e} mD<br>%{text}<extra></extra>`
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
        line: { dash: 'dash', color: '#9ca3af', width: 1.5 },
        showlegend: false, hoverinfo: 'skip'
      };
    });

    return [...traces, ...curvas];
  };

  // --- LÓGICA DO PLOTLY PARA GHE (k vs Phi com 10 Curvas e Pontos Sincronizados) ---
  const montarDadosGhePlotly = () => {

    const nomes_ghe = ['GHE 01', 'GHE 02', 'GHE 03', 'GHE 04', 'GHE 05', 'GHE 06', 'GHE 07', 'GHE 08', 'GHE 09', 'GHE 10', 'N.C'];
    // A mesma paleta de cores para os pontos e para as linhas (o último é o cinza do N.C)
    const cores_paleta = ['#e11d48', '#ea580c', '#d97706', '#65a30d', '#16a34a', '#059669', '#0891b2', '#2563eb', '#4f46e5', '#475569', '#9ca3af'];

    // 1. Plotagem dos dados reais (Pontos coloridos de acordo com o FZI)
    const traces = nomes_ghe.map((classe, index) => {
      const dadosFiltrados = chartData.filter(d => d.Classe_GHE === classe && d[eixoX] > 0 && d[eixoY] > 0);
      return {
        x: dadosFiltrados.map(d => d[eixoX]),
        y: dadosFiltrados.map(d => d[eixoY]),
        text: dadosFiltrados.map(d => `FZI: ${d.FZI ? d.FZI.toFixed(3) : 'N/A'}`),
        mode: 'markers',
        type: 'scatter',
        name: classe, // Isso fará a legenda dos pontos aparecer certinha
        marker: { color: cores_paleta[index], size: 7, line: { color: 'white', width: 0.5 } }, // Borda branca fina para destaque
        hovertemplate: `<b>${classe}</b><br>Φ: %{x:.2f}<br>K: %{y:.2e} mD<br>%{text}<extra></extra>`
      };
    }).filter(trace => trace.x.length > 0);

    // 2. Montagem das 10 Curvas Teóricas do GHE (Linhas de referência)
    const fzi_valores = [0.05, 0.15, 0.5, 1.5, 4.5, 13.5, 40, 120, 360, 1000];

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
        name: `Curva ${nomes_ghe[index]}`,
        line: { width: 1.0, color: cores_paleta[index] }, // Mesma cor do ponto correspondente
        showlegend: false, // Esconde a legenda da linha para não poluir, já que a cor do ponto já explica
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
          
          <img 
            src="/logo.jpg" 
            alt="Logo RonCore Analytics" 
            className="w-32 h-32 md:w-36 md:h-36 object-cover rounded-3xl shadow-[0_0_40px_rgba(59,130,246,0.3)] mb-8 border border-white/10" 
          />

          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-6 drop-shadow-2xl">
            RonCore <span className="bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">Analytics</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-300 font-light mb-16 max-w-2xl leading-relaxed opacity-90">
            Automação avançada para caracterização de reservatórios carbonáticos. 
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

            {/* Botão de Instalação sempre visível se não estiver em modo App (standalone) */}
            {!window.matchMedia('(display-mode: standalone)').matches && (
              <button 
                onClick={handleInstallClick}
                className="group flex flex-col items-center gap-4 text-slate-400 hover:text-white transition-all duration-300"
              >
                <span className="text-xs uppercase tracking-[0.4em] font-bold opacity-60 group-hover:opacity-100 transition-opacity">
                  {deferredPrompt ? 'Instalar App' : 'App Desktop'}
                </span>
                <div className="p-4 bg-emerald-500/10 rounded-full border border-emerald-500/20 group-hover:bg-emerald-500/20 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
              </button>
            )}
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

        {/* MENU DE ABAS */}
        <div className="flex justify-center border-b border-slate-700 mb-8">
          <button
            onClick={() => { setAbaAtiva('lucia'); handleReset(); }}
            className={`py-2 px-6 font-semibold text-sm border-b-2 transition-colors ${abaAtiva === 'lucia' ? 'border-blue-400 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
          >
            Método de Lucia
          </button>
          <button
            onClick={() => { setAbaAtiva('ghe'); handleReset(); }}
            className={`py-2 px-6 font-semibold text-sm border-b-2 transition-colors ${abaAtiva === 'ghe' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
          >
            Método GHE (FZI)
          </button>
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
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-500/40 rounded-2xl p-12 flex flex-col items-center cursor-pointer bg-slate-800/40 backdrop-blur-md hover:bg-slate-800/60 hover:border-blue-400 hover:shadow-lg transition-all duration-300 group"
            >
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xlsx, .xls" className="hidden" />
              <div className="text-5xl mb-4 group-hover:scale-110 group-hover:-translate-y-1 transition-transform duration-300 drop-shadow-sm">📥</div>
              <p className="text-xl font-medium text-slate-200 text-center">Arraste sua planilha Excel aqui</p>
              <p className="text-sm text-slate-400 mt-2 font-medium">ou clique para selecionar o arquivo</p>
            </div>

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
            <button onClick={handleClassificar} disabled={isProcessing} className="w-full py-3 px-4 rounded-lg shadow-md text-white font-semibold bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 mt-4 flex justify-center items-center focus:ring-offset-slate-900">
              {isProcessing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Processando...
                </>
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
            <div className="w-full">

              {/* CHAVEADOR DE ABAS */}
              {abaAtiva === 'lucia' ? (

                <div className="flex flex-col lg:flex-row gap-6">
                  {/* GRÁFICO 1: PLOTLY (Interativo, Zoom nativo, Curvas Semi-Log) */}
                  <div className={`w-full border shadow-sm rounded-2xl p-2 h-[500px] transition-colors ${chartTheme === 'dark' ? 'bg-slate-900/40 backdrop-blur-sm border-slate-700/80' : 'bg-white border-slate-300'}`}>
                    <h3 className={`text-center text-sm font-semibold mb-1 mt-2 ${chartTheme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Linear vs Log (Interativo com Zoom)</h3>
                    {eixoX !== 'nenhum' && eixoY !== 'nenhum' ? (
                      <Plot
                        data={montarDadosPlotly() as any}
                        useResizeHandler={true}
                        style={{ width: '100%', height: '90%' }}
                        layout={{
                          autosize: true,
                          margin: { t: 10, r: 20, b: 40, l: 80 },
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
                          legend: { orientation: 'h', y: -0.2 }
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
                  <div className={`w-full border shadow-sm rounded-2xl p-4 h-[600px] transition-colors ${chartTheme === 'dark' ? 'bg-slate-900/40 backdrop-blur-sm border-slate-700/80' : 'bg-white border-slate-300'}`}>
                    <h3 className={`text-center text-sm font-semibold mb-2 mt-2 ${chartTheme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      Método GHE: Permeabilidade vs Porosidade (Amaefule et al., 1993)
                    </h3>
                    {chartData.length > 0 && eixoX !== 'nenhum' && eixoY !== 'nenhum' ? (
                      <Plot
                        data={montarDadosGhePlotly() as any}
                        useResizeHandler={true}
                        style={{ width: '100%', height: '90%' }}
                        layout={{
                          autosize: true,
                          margin: { t: 10, r: 20, b: 40, l: 80 },
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
                            gridcolor: chartTheme === 'dark' ? '#1e293b' : '#e5e7eb',
                            zerolinecolor: chartTheme === 'dark' ? '#334155' : '#9ca3af',
                            tickformat: '.1e', exponentformat: 'power'
                          },
                          plot_bgcolor: chartTheme === 'dark' ? '#0B1120' : '#ffffff',
                          paper_bgcolor: chartTheme === 'dark' ? '#0B1120' : '#ffffff',
                          font: { color: chartTheme === 'dark' ? '#ffffff' : '#374151' },
                          hoverlabel: { font: { color: chartTheme === 'dark' ? '#ffffff' : '#111827' } },
                          legend: { orientation: 'h', y: -0.2 } // Legenda horizontal embaixo
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

              {/* === NOVOS GRÁFICOS RECHARTS NEON === */}
              {chartData.length > 0 && eixoX !== 'nenhum' && eixoY !== 'nenhum' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 animate-slide-up-delayed">
                  {/* Gráfico de Distribuição (BarChart) */}
                  <div className={`w-full border shadow-sm rounded-2xl p-4 h-[350px] transition-colors flex flex-col items-center ${chartTheme === 'dark' ? 'bg-[#0B1120] border-slate-700' : 'bg-white border-slate-300'}`}>
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
                          {distribuicaoData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} style={{ filter: chartTheme === 'dark' ? `drop-shadow(0 0 8px ${entry.fill})` : 'none' }} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-4 mt-2 mb-2 w-full">
                      {currentLegendPayload.map((item, i) => (
                        <div key={i} className="flex items-center text-xs font-semibold" style={{ color: chartTheme === 'dark' ? '#ffffff' : '#475569' }}>
                          <span className="w-3 h-3 rounded-full mr-2 inline-block" style={{ backgroundColor: item.color, boxShadow: chartTheme === 'dark' ? `0 0 6px ${item.color}` : 'none' }}></span>
                          {item.value}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Gráfico de Dispersão (ScatterChart) */}
                  <div className={`w-full border shadow-sm rounded-2xl p-4 h-[350px] transition-colors flex flex-col items-center ${chartTheme === 'dark' ? 'bg-[#0B1120] border-slate-700' : 'bg-white border-slate-300'}`}>
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
                          {dispersaoData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} style={{ filter: chartTheme === 'dark' ? `drop-shadow(0 0 6px ${entry.fill})` : 'none' }} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-4 mt-2 mb-2 w-full">
                      {currentLegendPayload.map((item, i) => (
                        <div key={i} className="flex items-center text-xs font-semibold" style={{ color: chartTheme === 'dark' ? '#cbd5e1' : '#475569' }}>
                          <span className="w-3 h-3 rounded-full mr-2 inline-block" style={{ backgroundColor: item.color, boxShadow: chartTheme === 'dark' ? `0 0 6px ${item.color}` : 'none' }}></span>
                          {item.value}
                        </div>
                      ))}
                    </div>
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
                  onClick={baixarRelatorioCompleto}
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
      </div>
      {/* Botão Flutuante sempre visível se não instalado */}
      {!window.matchMedia('(display-mode: standalone)').matches && (
        <button
          onClick={handleInstallClick}
          className="fixed bottom-8 right-8 z-50 flex items-center gap-3 px-5 py-3 bg-[#131b2f]/80 backdrop-blur-xl border border-emerald-500/30 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] hover:bg-emerald-500/10 hover:border-emerald-500/50 hover:scale-105 transition-all duration-300 group"
        >
          <div className="p-2 bg-emerald-500/20 rounded-full group-hover:bg-emerald-500/30 transition-colors">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <span className="text-sm font-bold text-emerald-400 tracking-wide uppercase">
            {deferredPrompt ? 'Instalar App' : 'Instalar'}
          </span>
        </button>
      )}
    </div>
    </div>
  );
}

export default App;
