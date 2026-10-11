export const COLORS = [
  { name: '赤', hex: '#f34c58', key: '1' },
  { name: '青', hex: '#3586e8', key: '2' },
  { name: '黄', hex: '#ffca29', key: '3' },
  { name: '緑', hex: '#39b463', key: '4' },
];

export const GAMES = [
  { id: 'ten', title: 'ぴったり10秒', subtitle: '動く数字に惑わされず、心で10秒。', meta: '1人から ／ 30秒', tone: 'yellow', icon: 'clock', guide: 'スタートを押すと、案内のあとに3・2・1が出ます。数字が消えたら、心の中で10秒を数えて押そう！' },
  { id: 'rps', title: 'あと出しじゃんけん', subtitle: '勝って、負けて、頭の体操。', meta: '1人 ／ 約1分', tone: 'blue', icon: 'hand', guide: '相手の手と「勝って」「負けて」のお題を見て、赤・青・黄から答えを選ぼう。' },
  { id: 'team', title: 'みんなで100点', subtitle: 'みんなのタイミング、ひとつに。', meta: '2〜4人 ／ 約1分', tone: 'pink', icon: 'buttons', guide: '一人ずつ違う色を担当。動くメーターが真ん中に来たら押そう！' },
  { id: 'light', title: 'ひかってポン', subtitle: '光った合図で、ポン！', meta: '1人 ／ 約1分', tone: 'list', icon: 'sun', guide: '「いまだ！」の合図を見てから、どのボタンでも押そう。' },
  { id: 'sound', title: '音が止まったら押せ', subtitle: '音の終わりに耳をすませて。', meta: '1人 ／ 約1分', tone: 'list', icon: 'music', guide: '「歓喜の歌」の演奏が止まったら押そう。画面にも合図が出るよ。' },
  { id: 'quiz', title: 'しぜんクイズ', subtitle: '大きな絵から、どっちか見つけよう。', meta: '1人 ／ 約1分', tone: 'list', icon: 'question', guide: '拡大した自然の絵が少しずつ見えてきます。お題に合う絵を、赤か青で選ぼう。' },
  { id: 'red', title: 'いろあわせポン', subtitle: '左右が同じ色なら、ポン！', meta: '1人 ／ 約1分', tone: 'list', icon: 'red', guide: '左と右が同じ色の時だけ押そう。違う色の時は待とう。' },
  { id: 'count', title: '数えてポン', subtitle: '目標の数で、ポン！', meta: '1人 ／ 約2分', tone: 'list', icon: 'numbers', guide: '画面に出る目標の数になったら、どのボタンでも押そう。' },
  { id: 'bigger', title: 'くらべてポン', subtitle: '数や長さ、時刻を見くらべよう。', meta: '1人 ／ 約1分', tone: 'list', icon: 'bars', guide: 'お題に合うほうを選ぼう。左は赤、右は青。' },
  { id: 'memory', title: 'おぼえてポン', subtitle: '色の順番、覚えられるかな？', meta: '1人 ／ 約1分', tone: 'list', icon: 'grid', guide: '光る色を覚えて、同じ順番で押そう。' },
];

// The renderer owns these image IDs. Labels are used for the question and
// feedback only; the two pictures stay unnamed while the player chooses.
export const NATURE_ITEMS = {
  tomato: 'トマト', 'red-apple': 'りんご', peach: 'もも', persimmon: 'かき',
  mandarin: 'みかん', carrot: 'にんじん', 'sweet-potato': 'さつまいも',
  potato: 'じゃがいも', kiwi: 'キウイ', cabbage: 'キャベツ', lettuce: 'レタス',
  watermelon: 'すいか', pumpkin: 'かぼちゃ', sunflower: 'ひまわり',
  dandelion: 'たんぽぽ', strawberry: 'いちご', cherry: 'さくらんぼ',
};

// Similar color or texture makes the initial close-up worth inspecting, while
// a fully revealed picture remains answerable without specialist knowledge.
const NATURE_PAIRS = [
  ['tomato', 'red-apple', 'tomato', 'トマトには星のようなへたがあり、りんごには細い軸があります。'],
  ['red-apple', 'peach', 'peach', 'ももには縦の割れ目があり、りんごとは表面の形が違います。'],
  ['peach', 'persimmon', 'persimmon', 'かきには大きく平たいへたがあります。'],
  ['mandarin', 'persimmon', 'mandarin', 'みかんは皮に細かな凹凸があり、かきのへたとは形が違います。'],
  ['carrot', 'mandarin', 'carrot', 'にんじんは長く先が細くなり、みかんは丸い形です。'],
  ['sweet-potato', 'potato', 'potato', 'じゃがいもには表面に小さなくぼみがあります。'],
  ['potato', 'kiwi', 'kiwi', 'キウイの皮には細かな毛があります。'],
  ['cabbage', 'lettuce', 'lettuce', 'レタスの葉は薄く波打ち、キャベツは丸く重なります。'],
  ['watermelon', 'pumpkin', 'watermelon', 'すいかの皮には濃いしま模様があります。'],
  ['sunflower', 'dandelion', 'sunflower', 'ひまわりには大きな丸い花の中心があります。'],
  ['strawberry', 'cherry', 'strawberry', 'いちごの表面には小さなつぶつぶがあります。'],
  ['tomato', 'cherry', 'cherry', 'さくらんぼには細く長い柄があります。'],
  ['kiwi', 'sweet-potato', 'sweet-potato', 'さつまいもは赤紫色の皮と細長い形が目印です。'],
  ['red-apple', 'cherry', 'red-apple', 'りんごの軸は短く、さくらんぼには細く長い柄があります。'],
];

export const QUIZ = NATURE_PAIRS.map(([left, right, target, explanation]) => ({
  q: `どちらが${NATURE_ITEMS[target]}？`,
  answers: [left, right].map(assetId => ({ assetId, label: NATURE_ITEMS[assetId] })),
  correct: left === target ? 0 : 1,
  explanation,
}));
