import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useRef, useMemo, useEffect, useState } from 'react'
import * as THREE from 'three'
import './App.css'
import TerrainSourcePanel from './terrain/TerrainSourcePanel'
import { PRESET_AREAS } from './terrain/presets'
import { useTerrainData } from './terrain/useTerrainData'

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

const MIN_BAR_HEIGHT = 0.05

function TerrainMap({ heightMapData, mapWidth = 50, mapHeight = 50, spacing = 0.5, colorMode = 'opacity', boxSize = 0.6 }) {
  const meshRefs = useRef([])

  // 找出最大和最小高度（真實地形點數可達 6 萬，避免使用 spread 參數）
  const { maxHeight, minHeight } = useMemo(() => {
    return heightMapData.reduce(
      (acc, d) => ({ maxHeight: Math.max(acc.maxHeight, d.height), minHeight: Math.min(acc.minHeight, d.height) }),
      { maxHeight: -Infinity, minHeight: Infinity }
    )
  }, [heightMapData])

  // 將資料分成10個高度區間
  const heightGroups = useMemo(() => {
    const groups = Array.from({ length: 10 }, () => [])
    const heightRange = maxHeight - minHeight || 1 // 全平地時避免除以 0

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
        const height = Math.max(point.height, MIN_BAR_HEIGHT) // 海面等 0 高度仍保留薄薄一層

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

function Scene({ terrain, terrainKey, colorMode, boxSize }) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[20, 30, 10]} intensity={0.8} />
      <directionalLight position={[-10, 20, -10]} intensity={0.4} />

      {terrain && (
        <TerrainMap
          key={`${terrainKey}-${boxSize}`}
          heightMapData={terrain.points}
          mapWidth={terrain.cols}
          mapHeight={terrain.rows}
          spacing={terrain.spacing}
          colorMode={colorMode}
          boxSize={boxSize}
        />
      )}

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
  const [source, setSource] = useState('simulated') // 'simulated' | 'terrarium'
  const [area, setArea] = useState(PRESET_AREAS[0].area)
  const [isAutoExaggeration, setIsAutoExaggeration] = useState(true)
  const [manualExaggeration, setManualExaggeration] = useState(1)

  const { terrain, terrainKey, status, error, summary } = useTerrainData({
    source, area, isCircular, sampling, isAutoExaggeration, manualExaggeration,
  })
  const exaggeration = summary?.exaggeration ?? manualExaggeration

  // 換範圍後比例尺不同，倍率切回自動
  const handleAreaChange = (nextArea) => {
    setArea(nextArea)
    setIsAutoExaggeration(true)
  }

  // 關閉自動時，從目前的自動倍率開始手動調整
  const handleAutoExaggerationChange = (isAuto) => {
    if (!isAuto) setManualExaggeration(exaggeration)
    setIsAutoExaggeration(isAuto)
  }

  const handleManualExaggerationChange = (value) => {
    setManualExaggeration(value)
    setIsAutoExaggeration(false)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <div style={{ position: 'absolute', top: 20, left: 20, color: '#fff', zIndex: 1, fontFamily: 'monospace', width: '260px' }}>
        <h3>3D 地圖高度視覺化</h3>
        <p>拖曳旋轉 | 滾輪縮放</p>
        <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexDirection: 'column' }}>
          <TerrainSourcePanel
            source={source}
            onSourceChange={setSource}
            area={area}
            onAreaChange={handleAreaChange}
            isAutoExaggeration={isAutoExaggeration}
            onAutoExaggerationChange={handleAutoExaggerationChange}
            exaggeration={exaggeration}
            onManualExaggerationChange={handleManualExaggerationChange}
            status={status}
            error={error}
            summary={summary}
          />
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
      </div>

      <Canvas 
        camera={{ position: [35, 30, 35], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene terrain={terrain} terrainKey={terrainKey} colorMode={colorMode} boxSize={boxSize} />
      </Canvas>
    </div>
  )
}

export default App
