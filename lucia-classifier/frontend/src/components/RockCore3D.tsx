import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Html, Float } from '@react-three/drei';
import * as THREE from 'three';

interface RockCore3DProps {
  dominantClass: string;
  theme: 'dark' | 'light';
}

const getRockMaterialProps = (dominantClass: string) => {
  // GHE Excellent (GHE 08-10) -> Greenish neon, high flow
  if (['GHE 08', 'GHE 09', 'GHE 10'].includes(dominantClass)) {
    return { color: '#10b981', emissive: '#059669', emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.2 };
  }
  // GHE Good (GHE 05-07) -> Cyan/Blueish
  if (['GHE 05', 'GHE 06', 'GHE 07'].includes(dominantClass)) {
    return { color: '#0ea5e9', emissive: '#0284c7', emissiveIntensity: 0.4, roughness: 0.5, metalness: 0.1 };
  }
  // GHE Medium (GHE 02-04) -> Amber
  if (['GHE 02', 'GHE 03', 'GHE 04'].includes(dominantClass)) {
    return { color: '#f59e0b', emissive: '#d97706', emissiveIntensity: 0.2, roughness: 0.7, metalness: 0.1 };
  }
  // GHE Poor / N.C / Classe 3 -> Grayish/Reddish
  if (dominantClass === 'GHE 01' || dominantClass === 'Classe 3') {
    return { color: '#ef4444', emissive: '#b91c1c', emissiveIntensity: 0.1, roughness: 0.9, metalness: 0.0 };
  }
  
  // Lucia Classe 1 -> Cyan
  if (dominantClass === 'Classe 1') {
    return { color: '#22d3ee', emissive: '#0891b2', emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.2 };
  }
  // Lucia Classe 2 -> Emerald
  if (dominantClass === 'Classe 2') {
    return { color: '#34d399', emissive: '#059669', emissiveIntensity: 0.3, roughness: 0.5, metalness: 0.1 };
  }

  // Default / Deficient
  return { color: '#64748b', emissive: '#334155', emissiveIntensity: 0.1, roughness: 1.0, metalness: 0.0 };
};

const DigitalTwinCore = ({ dominantClass }: { dominantClass: string }) => {
  const groupRef = useRef<THREE.Group>(null);
  const scannerRef = useRef<THREE.Mesh>(null);
  const scannerLightRef = useRef<THREE.PointLight>(null);
  const matProps = getRockMaterialProps(dominantClass);

  // Animação Frame-a-Frame do gêmeo digital
  useFrame((state) => {
    const elapsedTime = state.clock.getElapsedTime();
    if (groupRef.current) {
      // Rotação suave do conjunto completo
      groupRef.current.rotation.y = elapsedTime * 0.2;
    }
    if (scannerRef.current && scannerLightRef.current) {
      // O scanner sobe e desce usando uma onda seno (de -1.5 a 1.5 na altura do cilindro que é 3.5)
      const scanHeight = Math.sin(elapsedTime * 1.5) * 1.8;
      scannerRef.current.position.y = scanHeight;
      scannerLightRef.current.position.y = scanHeight;
    }
  });

  return (
    <group ref={groupRef}>
      <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.5} floatingRange={[-0.1, 0.1]}>
        
        {/* NÚCLEO SÓLIDO (O Testemunho Físico) */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[1, 1, 3.5, 64, 4, false]} />
          <meshStandardMaterial 
            color={matProps.color} 
            emissive={matProps.emissive}
            emissiveIntensity={matProps.emissiveIntensity * 0.5} // Menos emissive no sólido
            roughness={matProps.roughness}
            metalness={matProps.metalness}
            wireframe={false}
          />
        </mesh>

        {/* MALHA HOLOGRÁFICA (O Gêmeo Digital Wireframe) */}
        <mesh>
          <cylinderGeometry args={[1.05, 1.05, 3.6, 32, 16, true]} />
          <meshStandardMaterial 
            color={matProps.emissive} 
            emissive={matProps.emissive}
            emissiveIntensity={1.5}
            transparent={true}
            opacity={0.3}
            wireframe={true}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* SCANNER A LASER */}
        <mesh ref={scannerRef} rotation-x={Math.PI / 2}>
          <torusGeometry args={[1.2, 0.05, 16, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
          {/* Luz do Laser acoplada ao Anel */}
          <pointLight ref={scannerLightRef} color={matProps.emissive} intensity={3} distance={5} />
        </mesh>

        {/* HUD HOLOGRÁFICO DA CLASSE (Html Drei) */}
        <Html position={[1.5, 1.0, 0]} center transform sprite zIndexRange={[100, 0]} scale={0.5}>
          <div className="bg-[#0B1120]/80 backdrop-blur-md border border-slate-700/50 p-1 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.5)] whitespace-nowrap select-none w-20 pointer-events-none">
            <div className="text-[6px] uppercase text-cyan-400 font-bold tracking-[0.2em] mb-0.5 flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse"></div>
              Sistema RonCore
            </div>
            <div className="text-white text-sm font-black mb-0.5 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
              {dominantClass}
            </div>
            <div className="w-full bg-slate-700/50 h-[1px] mb-1 overflow-hidden">
              <div className="h-full bg-cyan-400 w-[78%]"></div>
            </div>
            <div className="flex justify-between text-[6px] text-slate-400 uppercase font-mono">
              <span>SCAN</span>
              <span className="text-emerald-400">ATIVO</span>
            </div>
          </div>
        </Html>
        
        {/* HUD ESTATÍSTICO INFERIOR */}
        <Html position={[-1.7, -1.0, 0]} center transform sprite zIndexRange={[100, 0]} scale={0.5}>
           <div className="bg-[#0B1120]/80 backdrop-blur-md border border-slate-700/50 p-1 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.5)] text-center w-20 select-none pointer-events-none border-l-2 border-l-blue-500">
             <div className="text-[6px] uppercase tracking-widest text-slate-400 font-mono">ESTRUTURA</div>
             <div className="text-[9px] font-bold text-slate-200">INTEGRIDADE HIGH</div>
           </div>
        </Html>
      </Float>
    </group>
  );
};

export const RockCore3D: React.FC<RockCore3DProps> = ({ dominantClass, theme }) => {
  // Configuro um fundo transparente para herdar o background bonito da home
  return (
    <Canvas shadows camera={{ position: [-5, 3, 6], fov: 50 }} style={{ background: 'transparent' }}>
      <ambientLight intensity={theme === 'dark' ? 0.3 : 0.8} />
      
      {/* Luz principal vinda de cima */}
      <directionalLight 
        position={[5, 10, 5]} 
        intensity={theme === 'dark' ? 1.5 : 1} 
        castShadow 
        shadow-mapSize={1024}
        shadow-bias={-0.0001}
      />
      
      {/* Refletor de ambiente secundário */}
      <spotLight 
        position={[-10, 5, -10]} 
        intensity={1} 
        color="#3b82f6" 
        penumbra={1} 
      />
      
      {/* O Gêmeo Digital Dinâmico */}
      <DigitalTwinCore dominantClass={dominantClass} />
      
      {/* GRADE DE SIMULAÇÃO (SCIFI FLOOR) */}
      <Grid 
        position={[0, -2.5, 0]} 
        args={[20, 20]} 
        cellSize={0.5} 
        cellThickness={1} 
        cellColor="#0284c7" // Azul 
        sectionSize={2.5} 
        sectionThickness={1.5} 
        sectionColor="#38bdf8" 
        fadeDistance={15} 
        fadeStrength={1} 
      />

      {/* PEDESTAL CENTRAL */}
      <mesh position={[0, -2.4, 0]} receiveShadow>
        <cylinderGeometry args={[2, 2.5, 0.2, 32]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} metalness={0.2} />
      </mesh>
      
      {/* ARO DE LUZ NO PEDESTAL */}
      <mesh position={[0, -2.28, 0]} receiveShadow>
        <torusGeometry args={[2.0, 0.02, 16, 64]} />
        <meshBasicMaterial color="#0ea5e9" />
      </mesh>

      <OrbitControls 
        enablePan={false} 
        enableZoom={true} 
        minDistance={3}
        maxDistance={12}
        maxPolarAngle={Math.PI / 2 - 0.05} // Impede olhar debaixo do chão
        autoRotate={false} 
      />
    </Canvas>
  );
};

export default RockCore3D;
