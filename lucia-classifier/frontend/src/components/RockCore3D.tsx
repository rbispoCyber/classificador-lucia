import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, AccumulativeShadows, RandomizedLight } from '@react-three/drei';
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
  return { color: '#64748b', emissive: '#334155', emissiveIntensity: 0.05, roughness: 1.0, metalness: 0.0 };
};

const CoreCylinder = ({ dominantClass }: { dominantClass: string }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const matProps = getRockMaterialProps(dominantClass);

  // Slow rotation
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
      meshRef.current.rotation.x = 0.2; // slight tilt
    }
  });

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      {/* Testemunho Cilíndrico Padrão: Topo, Base, Altura, Segmentos Radiais, Segs Altura */ }
      <cylinderGeometry args={[1, 1, 3.5, 64, 4, false]} />
      {/* Material simulando a rocha. As rugosidades mudam de acordo com as classes */}
      <meshStandardMaterial 
        color={matProps.color} 
        emissive={matProps.emissive}
        emissiveIntensity={matProps.emissiveIntensity}
        roughness={matProps.roughness}
        metalness={matProps.metalness}
        wireframe={false}
      />
    </mesh>
  );
};

export const RockCore3D: React.FC<RockCore3DProps> = ({ dominantClass, theme }) => {
  return (
    <Canvas shadows camera={{ position: [0, 0, 6], fov: 45 }}>
      <ambientLight intensity={theme === 'dark' ? 0.3 : 0.8} />
      <directionalLight 
        position={[5, 5, 5]} 
        intensity={theme === 'dark' ? 1.5 : 1} 
        castShadow 
        shadow-mapSize={1024}
      />
      
      {/* Luz misteriosa vinda de baixo */}
      <pointLight position={[-5, -5, -5]} intensity={0.5} color="#3b82f6" />
      
      <CoreCylinder dominantClass={dominantClass} />
      
      {/* Sombra acumulada no piso */}
      <AccumulativeShadows temporal frames={100} alphaTest={0.8} scale={10} position={[0, -2, 0]}>
        <RandomizedLight amount={8} radius={4} ambient={0.5} intensity={1} position={[5, 5, -10]} bias={0.001} />
      </AccumulativeShadows>

      <OrbitControls 
        enablePan={false} 
        enableZoom={true} 
        minDistance={3}
        maxDistance={10}
        autoRotate={false} 
      />
    </Canvas>
  );
};

export default RockCore3D;
