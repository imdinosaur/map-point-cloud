// 模擬的高度圖資料（多個正弦波疊加）
export function generateHeightMapData(width, height, isCircular = false, sampling = 1) {
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
