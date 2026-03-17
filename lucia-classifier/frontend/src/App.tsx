import React, { useState, useRef, type DragEvent } from 'react';
import axios from 'axios';
import Plot from 'react-plotly.js'; // Importando o Plotly para o gráfico único

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

  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const coresClasses: Record<string, string> = {
    'Classe 1': '#3b82f6',
    'Classe 2': '#22c55e',
    'Classe 3': '#ef4444',
    'N.C': '#9ca3af'
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
      const response = await axios.post(`${API_URL}/api/colunas`, formData);
      setColumns(response.data.colunas);
      setStep(2);
    } catch (error) {
      alert("Erro ao ler o arquivo Excel.");
    }
  };

  const handleClassificar = async () => {
    if (!file || poroCol === 'nenhum' || permCol === 'nenhum') return;
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', file); formData.append('col_poro', poroCol); formData.append('col_perm', permCol);

    try {
      const response = await axios.post(`${API_URL}/api/processar`, formData);
      const { dados_grafico, arquivo_b64 } = response.data;
      setChartData(dados_grafico); setEixoX(poroCol); setEixoY(permCol);

      const byteCharacters = atob(arquivo_b64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      setDownloadUrl(window.URL.createObjectURL(blob));
      setStep(3);
    } catch (error) {
      alert("Ocorreu um erro.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null); setColumns([]); setPoroCol('nenhum'); setPermCol('nenhum');
    setEixoX('nenhum'); setEixoY('nenhum'); setChartData([]); setDownloadUrl(null); setStep(1);
  };

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      <div className={`w-full bg-white rounded-xl shadow-xl border border-gray-100 p-8 ${step === 3 ? 'max-w-5xl' : (step === 1 ? 'max-w-3xl' : 'max-w-md')} transition-all duration-300`}>
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-6">Classificação de Lucia</h1>

        {step === 1 && (
          <div className="flex flex-col gap-8 mt-2 animate-fade-in">
            {/* Upload Area */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-400 rounded-xl p-12 flex flex-col items-center cursor-pointer bg-blue-50/50 hover:bg-blue-100/50 hover:border-blue-500 hover:shadow-inner transition-all duration-200 group"
            >
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xlsx, .xls" className="hidden" />
              <div className="text-5xl mb-4 group-hover:scale-110 group-hover:-translate-y-1 transition-transform duration-300 drop-shadow-sm">📥</div>
              <p className="text-xl font-medium text-blue-900 text-center">Arraste sua planilha Excel aqui</p>
              <p className="text-sm text-blue-600/80 mt-2 font-medium">ou clique para selecionar o arquivo</p>
            </div>

            {/* Formulas and Knowledge Area */}
            <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl p-6 border border-gray-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full -z-10"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-green-500/5 rounded-tr-full -z-10"></div>

              <h2 className="text-lg font-bold text-gray-800 mb-5 flex items-center">
                <svg className="w-6 h-6 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                Fundamento Matemático <span className="text-sm font-normal text-gray-500 ml-2 border-l border-gray-300 pl-2">Jennings & Lucia, 2003</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* RFN Equation */}
                <div className="col-span-1 md:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-gray-200/60 hover:shadow-md transition-shadow">
                  <h3 className="text-sm font-bold text-gray-600 mb-3 uppercase tracking-wider">Cálculo do Rock Fabric Number (RFN)</h3>
                  <div className="flex justify-center items-center bg-gray-800 text-green-400 font-mono text-sm sm:text-lg p-5 rounded-lg overflow-x-auto shadow-inner border border-gray-700">
                    <span>log(RFN) = </span>
                    <span className="inline-flex flex-col items-center align-middle ml-3">
                      <span className="border-b border-gray-500 pb-1 px-3 text-white">A + C × log(φ) - log(k)</span>
                      <span className="pt-1 px-3 text-gray-300">B + D × log(φ)</span>
                    </span>
                  </div>

                  {/* Constants Bubble */}
                  <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-mono">
                    <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full border border-gray-200 font-semibold shadow-sm">A = 9.7982</span>
                    <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full border border-gray-200 font-semibold shadow-sm">B = 12.0803</span>
                    <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full border border-gray-200 font-semibold shadow-sm">C = 8.6711</span>
                    <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full border border-gray-200 font-semibold shadow-sm">D = 8.2965</span>
                  </div>
                </div>

                {/* Classification Criteria */}
                <div className="col-span-1 md:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-gray-200/60 hover:shadow-md transition-shadow">
                  <h3 className="text-sm font-bold text-gray-600 mb-3 uppercase tracking-wider">Critérios de Classificação</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="relative overflow-hidden bg-blue-50 text-blue-900 p-4 rounded-xl text-center border-2 border-blue-200 shadow-sm hover:scale-[1.02] transition-transform">
                      <div className="font-bold text-base mb-1">Classe 1</div>
                      <div className="text-sm font-mono bg-blue-100/50 py-1 rounded inline-block px-3">0.5 ≤ RFN ≤ 1.5</div>
                    </div>
                    <div className="relative overflow-hidden bg-green-50 text-green-900 p-4 rounded-xl text-center border-2 border-green-200 shadow-sm hover:scale-[1.02] transition-transform">
                      <div className="font-bold text-base mb-1">Classe 2</div>
                      <div className="text-sm font-mono bg-green-100/50 py-1 rounded inline-block px-3">1.5 &lt; RFN ≤ 2.5</div>
                    </div>
                    <div className="relative overflow-hidden bg-red-50 text-red-900 p-4 rounded-xl text-center border-2 border-red-200 shadow-sm hover:scale-[1.02] transition-transform">
                      <div className="font-bold text-base mb-1">Classe 3</div>
                      <div className="text-sm font-mono bg-red-100/50 py-1 rounded inline-block px-3">2.5 &lt; RFN ≤ 4.0</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Porosidade ($\phi$)</label>
              <select className="w-full border border-gray-300 rounded-md p-2" value={poroCol} onChange={(e) => setPoroCol(e.target.value)}>
                <option value="nenhum">Nenhum</option> {columns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Permeabilidade ($k$)</label>
              <select className="w-full border border-gray-300 rounded-md p-2" value={permCol} onChange={(e) => setPermCol(e.target.value)}>
                <option value="nenhum">Nenhum</option> {columns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
            </div>
            <button onClick={handleClassificar} disabled={isProcessing} className="w-full py-3 px-4 rounded-lg shadow-md text-white font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mt-4 flex justify-center items-center">
              {isProcessing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Processando...
                </>
              ) : 'Processar e Gerar Gráfico'}
            </button>
            <button onClick={handleReset} className="w-full py-3 px-4 rounded-lg border border-gray-300 text-gray-700 font-semibold bg-white hover:bg-gray-50 transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2 mt-2">Cancelar</button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Eixo X</label>
                <select className="w-full border border-gray-300 rounded-md p-2" value={eixoX} onChange={(e) => setEixoX(e.target.value)}>
                  <option value="nenhum">Nenhum</option> {columns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Eixo Y</label>
                <select className="w-full border border-gray-300 rounded-md p-2" value={eixoY} onChange={(e) => setEixoY(e.target.value)}>
                  <option value="nenhum">Nenhum</option> {columns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>
            </div>
            <div className="w-full">

              {/* GRÁFICO 1: PLOTLY (Interativo, Zoom nativo, Curvas Semi-Log) */}
              <div className="w-full bg-gray-50 border rounded-lg p-2 h-[500px]">
                <h3 className="text-center text-sm font-semibold text-gray-600 mb-1">Linear vs Log (Interativo com Zoom)</h3>
                {eixoX !== 'nenhum' && eixoY !== 'nenhum' ? (
                  <Plot
                    data={montarDadosPlotly() as any}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '90%' }}
                    layout={{
                      autosize: true,
                      margin: { t: 10, r: 20, b: 40, l: 60 },
                      hovermode: 'closest',
                      xaxis: {
                        title: { text: eixoX },
                        type: 'log',
                        range: [-2, Math.log10(0.5)], // O Plotly usa o expoente diretamente
                        gridcolor: '#e5e7eb', zerolinecolor: '#9ca3af',
                        tickformat: '.1e', // Força notação cientifica
                        exponentformat: 'power', // Transforma e-01 em 10^-1
                        dtick: 1 // Garante que as marcações principais cresçam de 1 em 1 log (ou seja, 10x)
                      },
                      yaxis: {
                        title: { text: eixoY }, type: 'log',
                        range: [-7, 8], // O Plotly usa o expoente diretamente quando type='log'
                        gridcolor: '#e5e7eb', zerolinecolor: '#9ca3af',
                        tickformat: '.1e',
                        exponentformat: 'power',
                        dtick: 1
                      },
                      plot_bgcolor: '#f9fafb', paper_bgcolor: 'transparent',
                      legend: { orientation: 'h', y: -0.2 }
                    }}
                    config={{ displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] }}
                  />
                ) : null}
              </div>

            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              {downloadUrl && (
                <a href={downloadUrl} download={`Classificado_${file?.name}`} className="flex-1 flex justify-center items-center py-3 px-6 rounded-lg shadow-md text-white font-semibold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  Baixar Planilha Processada
                </a>
              )}
              <button onClick={handleReset} className="flex-1 flex justify-center items-center py-3 px-6 rounded-lg shadow-sm border border-gray-300 text-gray-700 font-semibold bg-white hover:bg-gray-50 transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                Analisar Outro Arquivo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
