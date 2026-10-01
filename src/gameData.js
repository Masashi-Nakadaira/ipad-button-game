export const COLORS = [
  { name: '赤', hex: '#f34c58', key: '1' },
  { name: '青', hex: '#3586e8', key: '2' },
  { name: '黄', hex: '#ffca29', key: '3' },
  { name: '緑', hex: '#39b463', key: '4' },
];

export const GAMES = [
  { id: 'ten', title: 'ぴったり10秒', subtitle: '動く数字に惑わされず、心で10秒。', meta: '1人から ／ 30秒', tone: 'yellow', icon: 'clock', guide: '音声の合図が終わったらスタート。動く数字に惑わされず、心の中で10秒を数えて押そう！' },
  { id: 'rps', title: 'あと出しじゃんけん', subtitle: '勝って、負けて、頭の体操。', meta: '1人 ／ 約1分', tone: 'blue', icon: 'hand', guide: '相手の手と「勝って」「負けて」のお題を見て、赤・青・黄から答えを選ぼう。' },
  { id: 'team', title: 'みんなで100点', subtitle: 'みんなのタイミング、ひとつに。', meta: '2〜4人 ／ 約1分', tone: 'pink', icon: 'buttons', guide: '一人ずつ違う色を担当。動くメーターが真ん中に来たら押そう！' },
  { id: 'light', title: 'ひかってポン', subtitle: '光った合図で、ポン！', meta: '1人 ／ 約1分', tone: 'list', icon: 'sun', guide: '「いまだ！」の合図で、どのボタンでも押そう。途中の光には気をつけて。' },
  { id: 'sound', title: '音が止まったら押せ', subtitle: '音の終わりに耳をすませて。', meta: '1人 ／ 約1分', tone: 'list', icon: 'music', guide: '「歓喜の歌」の演奏が止まったら押そう。画面にも合図が出るよ。' },
  { id: 'quiz', title: '昔クイズ早押し', subtitle: '暮らしと季節の知恵に挑戦。', meta: '1人 ／ 約1分', tone: 'list', icon: 'question', guide: '3つの答えから選んで、対応する色を1回押そう。' },
  { id: 'red', title: 'いろあわせポン', subtitle: '左右が同じ色なら、ポン！', meta: '1人 ／ 約1分', tone: 'list', icon: 'red', guide: '左と右が同じ色の時だけ押そう。違う色の時は待とう。' },
  { id: 'count', title: '数えてポン', subtitle: '目標の数で、ポン！', meta: '1人 ／ 約1分', tone: 'list', icon: 'numbers', guide: '画面に出る目標の数になったら、どのボタンでも押そう。' },
  { id: 'bigger', title: 'くらべてポン', subtitle: '計算や単位、時刻も見くらべよう。', meta: '1人 ／ 約1分', tone: 'list', icon: 'bars', guide: 'お題に合うほうを選ぼう。左は赤、右は青。' },
  { id: 'memory', title: 'おぼえてポン', subtitle: '色の順番、覚えられるかな？', meta: '1人 ／ 約1分', tone: 'list', icon: 'grid', guide: '光る色を覚えて、同じ順番で押そう。' },
];

// Seasonal customs: https://www.maff.go.jp/hokkaido/suishin/shokuiku/huyu_gyoji.html
// Nanakusa date: https://www.maff.go.jp/j/syokuiku/attach/pdf/index-121.pdf
// Traditional volume units: https://crd.ndl.go.jp/reference/entry/reference/show?id=1000244204&page=ref_view
// Showa events: https://global.jr-central.co.jp/en/company/about_shinkansen/
// https://www.expo2025.or.jp/en/expo-archive/japanpavilion/assets/pdf/library-en-history-first-part.pdf
// https://library.olympics.com/Default/basicfilesdownload.ashx?itemGuid=2ECE9BE9-EA5F-4F0F-97DF-84C75B6BC60A
// Tower of the Sun: https://taiyounotou-expo70.jp/about/
// NHK television launch: https://www.archives.go.jp/ayumi/kobetsu/s28_1953_01.html
// Opening broadcast record: https://www.bpcj.or.jp/program/detail/000011/
// LP/EP record sizes: https://www.audio-technica.co.jp/document/AT-LP70X/ja/Content/Turntable/AT-LP70X/using/before-playing-record.html
// First Shinkansen 0 series: https://jr-central.co.jp/news/release/_pdf/000043833.pdf
const SLOW_QUIZ = [
  { q: '1升は何合？', answers: ['5合', '10合', '20合'], correct: 1, explanation: '1升は10合です。' },
  { q: '1ダースは何個？', answers: ['10個', '12個', '24個'], correct: 1, explanation: '1ダースは12個です。' },
  { q: '令和の一つ前の元号は？', answers: ['昭和', '平成', '大正'], correct: 1, explanation: '昭和の次が平成、その次が令和です。' },
  { q: '十二支に入っていない動物は？', answers: ['犬', '猫', '馬'], correct: 1, explanation: '犬と馬は十二支に入りますが、猫は入りません。' },
  { q: '冬至の日、湯船に浮かべる果物は？', answers: ['みかん', 'ゆず', 'りんご'], correct: 1, explanation: '冬至には「ゆず湯」に入る習わしがあります。' },
  { q: '七草がゆを食べるのは何月何日？', answers: ['1月1日', '1月7日', '2月3日'], correct: 1, explanation: '七草がゆは1月7日の朝に食べる習わしです。' },
  { q: '俳句の基本の音の並びは？', answers: ['五・七・五', '七・五・七', '五・五・七'], correct: 0, explanation: '俳句は五・七・五の十七音が基本です。' },
  { q: 'こいのぼりを飾る主な行事は？', answers: ['ひな祭り', '端午の節句', '七夕'], correct: 1, explanation: '端午の節句は5月5日です。' },
  { q: '七福神は何人の神様？', answers: ['5人', '7人', '8人'], correct: 1, explanation: '名前の通り7人の神様です。' },
  { q: '百人一首には何首の歌がある？', answers: ['50首', '100首', '200首'], correct: 1, explanation: '100人が一首ずつ詠んだ歌です。' },
  { q: '十二支が一巡するのは何年？', answers: ['10年', '12年', '24年'], correct: 1, explanation: '十二支は12年で一巡します。' },
  { q: '昭和の一つ前の元号は？', answers: ['大正', '明治', '平成'], correct: 0, explanation: '明治、大正、昭和の順です。' },
  { q: '七夕は何月何日？', answers: ['6月6日', '7月7日', '8月8日'], correct: 1, explanation: '七夕は7月7日です。' },
  { q: '1メートルは何センチメートル？', answers: ['10センチ', '100センチ', '1000センチ'], correct: 1, explanation: '1メートルは100センチメートルです。' },
  { q: 'そろばんの上の玉1つは、下の玉のいくつ分？', answers: ['2つ分', '5つ分', '10個分'], correct: 1, explanation: '上の玉は5を表します。' },
  { q: '元旦とは、いつのこと？', answers: ['大みそかの夜', '1月1日の朝', '1月7日の朝'], correct: 1, explanation: '元旦は元日の朝を指します。' },
  { q: '節分の豆まきで、一般的に使う豆は？', answers: ['炒った大豆', '生の小豆', '枝豆'], correct: 0, explanation: '炒った大豆をまくのが一般的です。' },
  { q: '昔ながらの畳表に使われる植物は？', answers: ['竹', 'いぐさ', '綿'], correct: 1, explanation: 'いぐさを編んで畳表を作ります。' },
  { q: 'ぜんまい時計を動かすため、定期的にすることは？', answers: ['水を入れる', 'ねじを巻く', '日に当てる'], correct: 1, explanation: 'ぜんまいを巻いて力をためます。' },
  { q: 'レコードの音を再生するとき、盤に触れるものは？', answers: ['ブラシ', '針', '鉛筆'], correct: 1, explanation: '針が盤の溝をたどって音を拾います。' },
  { q: '蚊帳を寝床の周りにつるす理由は？', answers: ['虫を防ぐ', '音を小さくする', '床を温める'], correct: 0, explanation: '蚊などの虫が入らないようにします。' },
  { q: '風呂敷の主な使い方は？', answers: ['火を起こす', '品物を包んで運ぶ', '畳を敷く'], correct: 1, explanation: '布で品物を包み、持ち運びます。' },
  { q: '足踏みミシンを動かすときに踏むものは？', answers: ['ペダル', '針', '糸巻き'], correct: 0, explanation: '足でペダルを踏んで動かします。' },
  { q: 'カセットテープに音を記録するのは？', answers: ['磁気テープ', '写真フィルム', 'レコード針'], correct: 0, explanation: '細い磁気テープに録音します。' },
];

const CHALLENGE_QUIZ = [
  { q: '最初の東京オリンピックが開かれた年は？', answers: ['1960年', '1964年', '1970年'], correct: 1, explanation: '東京大会は1964年に開かれました。' },
  { q: '東海道新幹線が開業した年は？', answers: ['1964年', '1970年', '1975年'], correct: 0, explanation: '1964年に東京・新大阪間で開業しました。' },
  { q: '大阪で最初の日本万国博覧会が開かれた年は？', answers: ['1964年', '1970年', '1975年'], correct: 1, explanation: '大阪万博は1970年に開かれました。' },
  { q: '初めての東京五輪と初めての大阪万博、先に開かれたのは？', answers: ['大阪万博', '東京五輪', '同じ年'], correct: 1, explanation: '東京五輪が1964年、大阪万博が1970年です。' },
  { q: '昭和39年は西暦何年？', answers: ['1959年', '1964年', '1970年'], correct: 1, explanation: '昭和39年は1964年です。' },
  { q: '昭和45年は西暦何年？', answers: ['1964年', '1970年', '1975年'], correct: 1, explanation: '昭和45年は1970年です。' },
  { q: '平成12年は西暦何年？', answers: ['1999年', '2000年', '2001年'], correct: 1, explanation: '平成12年は2000年です。' },
  { q: '令和元年は西暦何年？', answers: ['2018年', '2019年', '2020年'], correct: 1, explanation: '令和元年は2019年です。' },
  { q: '太陽の塔の頂上にある「黄金の顔」が表すのは？', answers: ['過去', '未来', '現在'], correct: 1, explanation: '黄金の顔は未来を表します。' },
  { q: '昭和28年に始まったのは？', answers: ['東海道新幹線', 'NHKテレビ本放送', '大阪万博'], correct: 1, explanation: 'NHKテレビ本放送は昭和28年、1953年に始まりました。' },
  { q: '東海道新幹線の初代車両は何系？', answers: ['100系', '0系', '300系'], correct: 1, explanation: '開業時に走った初代車両は0系です。' },
  { q: '開業時の東海道新幹線の両端は？', answers: ['東京・名古屋', '東京・新大阪', '東京・博多'], correct: 1, explanation: '1964年に東京・新大阪間で開業しました。' },
  { q: '90分は何時間何分？', answers: ['1時間15分', '1時間30分', '2時間30分'], correct: 1, explanation: '60分と30分で1時間30分です。' },
  { q: '1時間半は何分？', answers: ['75分', '90分', '120分'], correct: 1, explanation: '60分と30分で90分です。' },
  { q: '1m20cmと130cm、長いのは？', answers: ['1m20cm', '130cm', '同じ'], correct: 1, explanation: '1m20cmは120cmなので130cmが長いです。' },
  { q: 'うるう年の2月にある日は？', answers: ['28日まで', '29日まで', '30日まで'], correct: 1, explanation: 'うるう年の2月は29日まであります。' },
];

const NORMAL_QUIZ = [
  { q: '2時間半は何分？', answers: ['120分', '150分', '180分'], correct: 1, explanation: '2時間は120分、半時間は30分です。' },
  { q: '250mLのコップ4杯は何L？', answers: ['0.5L', '1L', '2L'], correct: 1, explanation: '250mLを4杯で1000mL、1Lです。' },
  { q: '太陽の塔を制作した芸術家は？', answers: ['横山大観', '岡本太郎', '棟方志功'], correct: 1, explanation: '岡本太郎が制作しました。' },
  { q: '平成元年は西暦何年？', answers: ['1988年', '1989年', '1990年'], correct: 1, explanation: '平成元年は1989年です。' },
  { q: '1964年の6年後は？', answers: ['1968年', '1970年', '1974年'], correct: 1, explanation: '1964に6を足すと1970です。' },
  { q: '太陽の塔の高さはおよそ何メートル？', answers: ['50m', '70m', '90m'], correct: 1, explanation: '高さは約70mです。' },
  { q: '昭和50年は西暦何年？', answers: ['1970年', '1975年', '1980年'], correct: 1, explanation: '昭和50年は1975年です。' },
  { q: '昭和60年は西暦何年？', answers: ['1980年', '1985年', '1990年'], correct: 1, explanation: '昭和60年は1985年です。' },
  { q: '平成10年は西暦何年？', answers: ['1995年', '1998年', '2000年'], correct: 1, explanation: '平成10年は1998年です。' },
  { q: '平成20年は西暦何年？', answers: ['2005年', '2008年', '2010年'], correct: 1, explanation: '平成20年は2008年です。' },
  { q: '令和5年は西暦何年？', answers: ['2021年', '2023年', '2025年'], correct: 1, explanation: '令和5年は2023年です。' },
  { q: '2kg300gは何g？', answers: ['2030g', '2300g', '3200g'], correct: 1, explanation: '2kgは2000gなので合わせて2300gです。' },
  { q: '1250mLは何L何mL？', answers: ['1L25mL', '1L250mL', '12L50mL'], correct: 1, explanation: '1000mLと250mLで1L250mLです。' },
  { q: '1m5cmは何cm？', answers: ['105cm', '150cm', '1005cm'], correct: 0, explanation: '1mは100cm、そこに5cmを足します。' },
  { q: '2.5mは何cm？', answers: ['205cm', '250cm', '2500cm'], correct: 1, explanation: '2.5mは250cmです。' },
  { q: '1時間45分は何分？', answers: ['95分', '105分', '145分'], correct: 1, explanation: '60分に45分を足して105分です。' },
  { q: '2時間15分は何分？', answers: ['125分', '135分', '215分'], correct: 1, explanation: '120分に15分を足して135分です。' },
  { q: '500mLの水6杯は何L？', answers: ['2L', '3L', '6L'], correct: 1, explanation: '500mLを6杯で3000mL、3Lです。' },
  { q: '5合は何升？', answers: ['半升', '1升', '2升'], correct: 0, explanation: '10合が1升なので5合は半升です。' },
  { q: '1升5合は合わせて何合？', answers: ['10合', '15合', '50合'], correct: 1, explanation: '1升は10合、さらに5合で15合です。' },
  { q: '3ダースは何個？', answers: ['30個', '36個', '48個'], correct: 1, explanation: '1ダース12個を3つで36個です。' },
  { q: 'NHKのテレビ本放送が始まった年は？', answers: ['1951年', '1953年', '1955年'], correct: 1, explanation: '1953年2月1日に始まりました。' },
  { q: '一般的なLPレコードの直径は？', answers: ['17cm', '30cm', '40cm'], correct: 1, explanation: 'LPは直径30cm、EPは17cmです。' },
  { q: '「太陽の塔」が建てられた行事は？', answers: ['東京オリンピック', '大阪万博', '札幌オリンピック'], correct: 1, explanation: '太陽の塔は1970年大阪万博のシンボルです。' },
];

export const QUIZ = [
  ...SLOW_QUIZ.map(question => ({ ...question, difficulty: 'slow' })),
  ...NORMAL_QUIZ.map(question => ({ ...question, difficulty: 'normal' })),
  ...CHALLENGE_QUIZ.map(question => ({ ...question, difficulty: 'challenge' }))
];
