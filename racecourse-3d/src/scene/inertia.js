import { Vector3 } from 'three'
import { RACE_SPEED } from './sceneConfig'

// 慣性：物理以角色為中心計算（避免被跑速吹平），因此要另外把「加速度」補回來。
// 加速座標系中的物體會感受到 -a 的假想力，與重力合成「視重力」：
// 過彎甩向外側、急停往前甩、坡度變化上下晃。

const GRAVITY = 9.8
export const INERTIA = {
  gain: 3, // 誇張倍率：實際過彎約 0.3 g，放大後雙馬尾才看得出甩動
  max: 1.2, // 上限（g）：急停、起跑時不會整束甩成水平以上
  // 往上的上限（g）：越過坡頂時向上的慣性若超過 1 g，視重力會朝上，頭髮翻過頭頂卡在胸前。
  // 斷面圖是折線、頂點處坡度瞬變，再乘上高度誇張倍率，尖峰很容易超過。
  maxUp: 0.5,
}
const VELOCITY_EASE = 20 // 速度平滑（1/s）：濾掉折線頂點造成的抖動
const ACCEL_EASE = 8 // 加速度平滑（1/s）
const TELEPORT_FACTOR = 3 // 單幀速度超過正常跑速幾倍視為瞬移（重新起跑、換跑法、拖動誇張度）
const TELEPORT_MARGIN = 5 // m/s，暫停後恢復時的小誤差

const ease = (rate, dt) => 1 - Math.exp(-rate * dt)

/**
 * 追蹤跑者位置，算出慣性造成的額外拉力（以 g 為單位、已乘誇張倍率並限制上限）。
 * 加速度以「比賽時間」計算：倍速播放時位置變化快 timeScale 倍、加速度快 timeScale² 倍，除回去後甩動幅度與播放速度無關。
 */
export function createInertiaTracker() {
  let previous = null
  let velocity = null
  let acceleration = new Vector3()

  const reset = (position) => {
    previous = position.clone()
    velocity = null
    acceleration = new Vector3()
  }

  return {
    /**
     * @param {Vector3} position 跑者世界座標（公尺）
     * @param {number} dt 秒
     * @param {number} timeScale 播放倍速
     * @returns {Vector3} 慣性力方向與大小（g），新物件
     */
    update(position, dt, timeScale) {
      if (!previous || dt <= 0) {
        if (!previous) reset(position)
        return new Vector3()
      }
      const rawVelocity = position.clone().sub(previous).divideScalar(dt)
      previous = position.clone()
      if (rawVelocity.length() > TELEPORT_FACTOR * RACE_SPEED * timeScale + TELEPORT_MARGIN) {
        reset(position)
        return new Vector3()
      }
      if (!velocity) {
        velocity = rawVelocity
        return new Vector3()
      }
      const nextVelocity = velocity.clone().lerp(rawVelocity, ease(VELOCITY_EASE, dt))
      const rawAcceleration = nextVelocity.clone().sub(velocity).divideScalar(dt * timeScale * timeScale)
      velocity = nextVelocity
      acceleration = acceleration.clone().lerp(rawAcceleration, ease(ACCEL_EASE, dt))
      const force = acceleration.clone().multiplyScalar(-INERTIA.gain / GRAVITY).clampLength(0, INERTIA.max)
      return force.setY(Math.min(force.y, INERTIA.maxUp))
    },
  }
}
