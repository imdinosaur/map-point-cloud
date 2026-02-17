import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useTexture } from '@react-three/drei'
import { useRef, useMemo, useEffect, useState } from 'react'
import * as THREE from 'three'
import './App.css'
import VideoAsciiDemo from './asciiPlayer/VideoAsciiDemo'

// 生成模擬的高度圖資料（實際使用時可以從圖片或API載入）
function generateHeightMapData(width, height, isCircular = false, sampling = 1) {
  const data = []
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) / 2
  
  for (let y = 0; y < height; y += sampling) {
    for (let x = 0; x < width; x += sampling) {
      // 如果是圓形模式，檢查點是否在圓內
      if (isCircular) {
        const dx = x - centerX
        const dy = y - centerY
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance > radius) continue // 跳過圓外的點
      }
      
      // 使用多個正弦波模擬地形
      const nx = x / width - 0.5
      const ny = y / height - 0.5
      const height1 = Math.sin(nx * Math.PI * 4) * Math.cos(ny * Math.PI * 4) * 0.3
      const height2 = Math.sin(nx * Math.PI * 8 + ny * Math.PI * 8) * 0.15
      const height3 = Math.sin((nx + ny) * Math.PI * 12) * 0.1
      const heightValue = (height1 + height2 + height3 + 0.5) * 10
      data.push({ x, y, height: heightValue })
    }
  }
  return data
}

// 根據高度區間獲取顏色
function getColorByHeightGroup(groupIndex) {
  const colors = [
    '#0066cc', // 0: 深藍
    '#0088cc', // 1: 藍
    '#00aacc', // 2: 青藍
    '#00cccc', // 3: 青色
    '#00ccaa', // 4: 青綠
    '#00ff99', // 5: 綠青
    '#66ff66', // 6: 淺綠
    '#99ff66', // 7: 黃綠
    '#ccff66', // 8: 淺黃綠
    '#ffffcc', // 9: 淺黃
  ]
  return colors[groupIndex] || '#00d9ff'
}

function TerrainMap({ mapWidth = 50, mapHeight = 50, spacing = 0.5, colorMode = 'opacity', isCircular = false, sampling = 1, boxSize = 0.6 }) {
  const meshRefs = useRef([])
  
  // 生成地形資料
  const heightMapData = useMemo(() => {
    return generateHeightMapData(mapWidth, mapHeight, isCircular, sampling)
  }, [mapWidth, mapHeight, isCircular, sampling])
  
  // 找出最大和最小高度
  const { maxHeight, minHeight } = useMemo(() => {
    const heights = heightMapData.map(d => d.height)
    return {
      maxHeight: Math.max(...heights),
      minHeight: Math.min(...heights)
    }
  }, [heightMapData])
  
  // 將資料分成10個高度區間
  const heightGroups = useMemo(() => {
    const groups = Array.from({ length: 10 }, () => [])
    const heightRange = maxHeight - minHeight
    
    heightMapData.forEach(point => {
      const normalized = (point.height - minHeight) / heightRange
      const groupIndex = Math.min(Math.floor(normalized * 10), 9)
      groups[groupIndex].push(point)
    })
    
    return groups
  }, [heightMapData, maxHeight, minHeight])
  
  // 為每個區間創建幾何體
  const geometries = useMemo(() => {
    return Array.from({ length: 10 }, () => 
      new THREE.BoxGeometry(spacing * boxSize, 1, spacing * boxSize)
    )
  }, [spacing, boxSize])
  
  // 設定每個區間的位置和縮放
  useEffect(() => {
    heightGroups.forEach((group, groupIndex) => {
      const meshRef = meshRefs.current[groupIndex]
      if (!meshRef || group.length === 0) return
      
      const tempObject = new THREE.Object3D()
      
      group.forEach((point, i) => {
        const x = (point.x - mapWidth / 2) * spacing
        const z = (point.y - mapHeight / 2) * spacing
        const height = point.height
        
        tempObject.position.set(x, height / 2, z)
        tempObject.scale.set(1, height, 1)
        tempObject.updateMatrix()
        
        meshRef.setMatrixAt(i, tempObject.matrix)
      })
      
      meshRef.instanceMatrix.needsUpdate = true
    })
  }, [heightMapData, mapWidth, mapHeight, spacing, heightGroups])
  
  // 輕微旋轉動畫
  useFrame((state) => {
    meshRefs.current.forEach(meshRef => {
      if (meshRef) {
        meshRef.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.1
      }
    })
  })
  
  return (
    <>
      {heightGroups.map((group, index) => {
        if (group.length === 0) return null
        
        // 根據模式決定顏色和透明度
        const isOpacityMode = colorMode === 'opacity'
        const heightRatio = index / 9 // 0-1 的高度比例
        
        let color, opacity, emissiveColor
        
        if (isOpacityMode) {
          // 透明度模式：統一水藍色，透明度變化（50%-80%）
          color = '#39C5BB'
          opacity = 0.5 + heightRatio * 0.45 // 低處50%，高處95%
          emissiveColor = '#39C5BB'
        } else {
          // 漸層色模式：顏色漸變，亮度和透明度固定100%
          color = getColorByHeightGroup(index)
          opacity = 1.0 // 固定100%透明度（完全不透明）
          emissiveColor = getColorByHeightGroup(index)
        }
        
        return (
          <instancedMesh
            key={index}
            ref={el => meshRefs.current[index] = el}
            args={[geometries[index], null, group.length]}
          >
            <meshStandardMaterial 
              color={color}
              metalness={0.5} 
              roughness={0.3}
              transparent={true}
              opacity={opacity}
              emissive={emissiveColor}
              emissiveIntensity={isOpacityMode ? 0.2 : 0.1 * (0.5 + heightRatio * 0.5)}
              depthWrite={opacity > 0.8}
            />
          </instancedMesh>
        )
      })}
    </>
  )
}

function Scene({ colorMode, isCircular, sampling, boxSize }) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[20, 30, 10]} intensity={0.8} />
      <directionalLight position={[-10, 20, -10]} intensity={0.4} />
      
      <TerrainMap 
        key={`${isCircular ? 'circular' : 'square'}-${sampling}-${boxSize}`}
        mapWidth={60} 
        mapHeight={60} 
        spacing={1.0} 
        colorMode={colorMode} 
        isCircular={isCircular}
        sampling={sampling}
        boxSize={boxSize}
      />
      
      {/* 網格輔助線 */}
      <gridHelper args={[50, 50, 0x333333, 0x111111]} position={[0, -1, 0]} />
      
      <OrbitControls 
        enableDamping 
        dampingFactor={0.05}
        minDistance={15}
        maxDistance={120}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  )
}

function App() {
  const [colorMode, setColorMode] = useState('opacity')
  const [isCircular, setIsCircular] = useState(false)
  const [sampling, setSampling] = useState(1)
  const [boxSize, setBoxSize] = useState(0.6)
  const [page, setPage] = useState('video') // 'map' or 'video'
  
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <div style={{ position: 'absolute', top: 20, left: 20, color: '#fff', zIndex: 1, fontFamily: 'monospace' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' ,  }} >
          <button
            onClick={() => setPage('map')}
            style={{
              padding: '6px 12px',
              background: page === 'map' ? '#ffffff' : '#00d9ff',
              border: 'none',
              borderRadius: '4px',
              color: '#000',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            地圖
          </button>
          <button 
            onClick={() => setPage('video')}
            style={{
              padding: '6px 12px',
              background: page === 'video' ? '#ffffff' : '#00d9ff',
              border: 'none',
              borderRadius: '4px',
              color: '#000',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ASCII 影片
          </button>
        </div>

        {page === 'map' && (
          <>
            <h3>3D 地圖高度視覺化</h3>
            <p>拖曳旋轉 | 滾輪縮放</p>
            <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexDirection: 'column' }}>
              <button
                onClick={() => setColorMode(colorMode === 'opacity' ? 'color' : 'opacity')}
                style={{
                  padding: '8px 16px',
                  background: '#00d9ff',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#000',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                {colorMode === 'opacity' ? '切換至漸層色' : '切換至透明度'}
              </button>
              <button
                onClick={() => setIsCircular(!isCircular)}
                style={{
                  padding: '8px 16px',
                  background: '#00d9ff',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#000',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                {isCircular ? '切換至方形' : '切換至圓形'}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontSize: '14px' }}>稀疏度:</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={sampling}
                  onChange={(e) => setSampling(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: '14px', minWidth: '30px' }}>{sampling}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontSize: '14px' }}>方柱大小:</label>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={boxSize}
                  onChange={(e) => setBoxSize(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: '14px', minWidth: '30px' }}>{boxSize.toFixed(1)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {page === 'map' ? (
        <Canvas 
          camera={{ position: [35, 30, 35], fov: 60 }}
          gl={{ antialias: true, alpha: true }}
        >
          <Scene colorMode={colorMode} isCircular={isCircular} sampling={sampling} boxSize={boxSize} />
        </Canvas>
      ) : (
        <div style={{ width: '100vw', height: '100vh' }}>
          <VideoAsciiDemo />
        </div>
      )}
    </div>
  )
}

export default App
