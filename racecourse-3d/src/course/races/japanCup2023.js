// 第43回ジャパンカップ(GI)（2023 年 11 月 26 日 東京 12R、芝左 2400m、良）
// 出處：JRA 公布的成績（經 netkeiba データベース race/202305050812 整理）。
// time：走破タイム；margin：着差（前一名起算）；last3F：上がり 3F（最後 600m）；passing：通過順位。
// laps：先頭馬每 200m 的ハロンタイム；corners：各コーナー通過順位（記號依 JRA 定義，見 replay.js）。

export const JAPAN_CUP_2023 = {
  id: 'jc2023',
  label: '2023 ジャパンC',
  name: '第43回ジャパンカップ(GI)',
  date: '2023-11-26',
  runId: 'turf-2400',
  going: '良',
  source: 'https://db.netkeiba.com/race/202305050812/',
  laps: [12.7, 11.3, 11.5, 11.0, 11.1, 11.5, 12.0, 12.1, 12.1, 12.4, 12.4, 11.7],
  corners: [
    '8-3-2-(1,17)(5,14)(7,4,15)(10,13)9,6(11,12)-16-18',
    '8=3-2-(1,17)(5,14)(7,4,15)-(10,13)-9-6(11,12)-16-18',
    '8=3,2(1,17)(5,14)(4,15)7(10,13)9,6,11-(16,12)-18',
    '8=3,2(1,17)(5,14,15)4,7(9,10)13,6(11,16)-12-18',
  ],
  horses: [
    { number: 2, name: 'イクイノックス', time: '2:21.8', margin: '', last3F: 33.5 },
    { number: 1, name: 'リバティアイランド', time: '2:22.5', margin: '4', last3F: 33.9 },
    { number: 17, name: 'スターズオンアース', time: '2:22.6', margin: '1', last3F: 34.0 },
    { number: 5, name: 'ドウデュース', time: '2:22.7', margin: '3/4', last3F: 33.7 },
    { number: 3, name: 'タイトルホルダー', time: '2:23.1', margin: '2', last3F: 35.0 },
    { number: 10, name: 'ダノンベルーガ', time: '2:23.2', margin: '1', last3F: 33.8 },
    { number: 9, name: 'ヴェラアズール', time: '2:23.3', margin: 'クビ', last3F: 33.8 },
    { number: 4, name: 'スタッドリー', time: '2:23.3', margin: 'クビ', last3F: 34.2 },
    { number: 7, name: 'イレジン', time: '2:23.5', margin: '1.1/2', last3F: 34.2 },
    { number: 14, name: 'ディープボンド', time: '2:23.6', margin: '1/2', last3F: 34.7 },
    { number: 15, name: 'ショウナンバシット', time: '2:23.8', margin: '1', last3F: 34.8 },
    { number: 8, name: 'パンサラッサ', time: '2:24.0', margin: '1.1/4', last3F: 38.7 },
    { number: 16, name: 'インプレス', time: '2:25.2', margin: '7', last3F: 35.0 },
    { number: 6, name: 'フォワードアゲン', time: '2:25.3', margin: '3/4', last3F: 35.3 },
    { number: 18, name: 'ウインエアフォルク', time: '2:26.2', margin: '5', last3F: 35.1 },
    { number: 11, name: 'トラストケンシン', time: '2:26.6', margin: '2', last3F: 36.4 },
    { number: 12, name: 'チェスナットコート', time: '2:27.0', margin: '2.1/2', last3F: 36.4 },
    { number: 13, name: 'クリノメガミエース', time: '2:27.9', margin: '5', last3F: 38.2 },
  ],
}
