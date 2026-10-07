import {
  EXAGGERATION,
  exaggerationFromSlider,
  isMemeSlope,
  slopeRise,
  sliderFromExaggeration,
} from './exaggerationScale'

/**
 * 高度誇張滑桿（對數刻度），並即時換算ゴール前の坂看起來有多高。
 * @param {{ exaggeration: number, onExaggerationChange: (v: number) => void }} props
 */
export default function ExaggerationSlider({ exaggeration, onExaggerationChange }) {
  const isMeme = isMemeSlope(exaggeration)

  return (
    <section className={`panel__group exaggeration${isMeme ? ' is-meme' : ''}`}>
      <div className="exaggeration__head">
        <label className="panel__label" htmlFor="exaggeration">
          高度誇張 ×{exaggeration}
        </label>
        <span className="exaggeration__rise">
          ゴール前の坂 <b>{slopeRise(exaggeration)}</b>m
        </span>
      </div>
      <input
        id="exaggeration"
        type="range"
        min="0"
        max={EXAGGERATION.sliderSteps}
        value={sliderFromExaggeration(exaggeration)}
        aria-valuetext={`×${exaggeration}，坂の高低差 ${slopeRise(exaggeration)}m`}
        onChange={(e) => onExaggerationChange(exaggerationFromSlider(Number(e.target.value)))}
      />
      <div className="exaggeration__scale">
        <button type="button" onClick={() => onExaggerationChange(EXAGGERATION.min)}>
          実寸 2m
        </button>
        <button type="button" className="exaggeration__meme-btn" onClick={() => onExaggerationChange(EXAGGERATION.max)}>
          200M →
        </button>
      </div>
      {isMeme && (
        <p className="exaggeration__meme" role="status">
          高低差<em>200M</em>の坂
        </p>
      )}
    </section>
  )
}
