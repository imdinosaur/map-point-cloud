import { Component } from 'react'

/**
 * 子元件載入失敗時改顯示 fallback（例如模型檔不存在時退回紅球）。
 * 角色模型不進版控，部署環境沒有模型檔是正常情況，所以只記錄警告。
 */
export default class FallbackBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.warn('角色模型載入失敗，改用替代標記：', error.message)
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}
