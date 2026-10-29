import { LANGUAGES, type Language } from '../languages.js';
import type { HypertextBlock } from '../schema/gui/hypertext.js';
import type { MapVariantBriefingPages } from './schema.js';

/** The `PlayCutscene` pages the map's opening mission and its `MissionWon` show. */
const OPENING_PAGE = 0;
const VICTORY_PAGE = 1;

/** Two or more empty lines open a new section of the book, which marks it with a rule. */
const SECTION_GAP_LINES = 2;
const blank: HypertextBlock = { kind: 'blank', lines: 1 };
const sectionGap: HypertextBlock = { kind: 'blank', lines: SECTION_GAP_LINES };

const title = (text: string): HypertextBlock => ({ kind: 'text', style: 'title', text, align: 'center' });
/** A red title, which the book sets as a solemn section heading. */
const solemnTitle = (text: string): HypertextBlock => ({
  kind: 'text',
  style: 'title',
  text,
  align: 'center',
  color: 'red',
});

/** Laid out like the map's own page: centred paragraphs a blank line apart. */
const paragraphs = (texts: readonly string[]): HypertextBlock[] =>
  texts.flatMap((text): HypertextBlock[] => [blank, { kind: 'text', style: 'body', text, align: 'center' }]);

interface PageText {
  readonly title: string;
  readonly paragraphs: readonly string[];
}

interface LanguageText {
  /** The map's story, told without the trade and the tribes to find that Ragnarök does not have. */
  readonly intro: PageText;
  /** What Ragnarök changes, without the times and band sizes the escalation data may tune. */
  readonly rules: PageText;
  readonly victory: PageText;
}

const TEXTS: Record<Language, LanguageText> = {
  pol: {
    intro: {
      title: 'FORTECA',
      paragraphs: [
        'Dla Wikingów nadeszły ciężkie czasy...\nKraj terroryzują oddziały siepaczy z fortecy znajdującej się w samym środku kraju. Przed tymi oprawcami nie ma ucieczki.',
        'Nie trzeba tu nikogo szukać ani nawiązywać kontaktów handlowych: wszystkie plemiona w grze, także Mieszkańcy równiny i Górale, są graczami i sojusznikami. Fortecę zdobędziecie tylko wspólnymi siłami!',
        'Plemiona Wikingów mogą przekazywać sobie ludzi: każ kilku Wikingom udać się do świętego ognia sojuszniczego plemienia Wikingów i przestąpić magiczny krąg ognia. Od tej chwili będą słuchać rozkazów sojusznika. Mieszkańców równiny i Górali ten rytuał nie obejmuje.',
        'Wskazówka: Jesteś w posiadaniu kilku listów z budynkami. Wykorzystaj je szybko i mądrze!',
      ],
    },
    rules: {
      title: 'RAGNARÖK',
      paragraphs: [
        'Forteca nie czeka na wasz atak. Jej siepacze napadają na każde plemię według stałego harmonogramu, za każdym razem silniej. Między atakami są krótkie przerwy, wykorzystaj je dobrze!',
        'Mniej więcej od połowy gry ataki nadchodzą także od morza: okręty fortecy przybijają do twoich brzegów i wysadzają wojowników.',
        'Z czasem siepacze zdobywają coraz lepszy ekwipunek: najpierw lepszą broń, lekkie zbroje i buty, potem ciężkie zbroje, amulety, a w końcu mikstury lecznicze.',
        'Załoga fortecy rośnie z upływem czasu i z liczbą plemion w grze, a zniszczone katapulty po pewnym czasie wracają na swoje miejsca.',
        'Forteca ma własnych budowniczych, którzy odbudowują to, co zniszczysz, i tragarzy, którzy zbierają łupy z pola walki.',
        'Złoża złota, żelaza i grzybów dają trzy razy więcej.',
        'Ile czasu zostało do następnego ataku, zobaczysz wśród celów misji.',
      ],
    },
    victory: {
      title: 'ZWYCIĘSTWO',
      paragraphs: [
        'Forteca padła! Ostatni siepacze legli wśród zgliszcz jej murów, a nad krajem po raz pierwszy od lat wstaje spokojny dzień.',
        'Ragnarök nie nadszedł. Plemiona, które razem stawiły czoła oprawcom, przetrwały ataki z lądu i z morza i wspólnymi siłami zdobyły twierdzę.',
        'Kraj jest wolny. Wikingowie, Mieszkańcy równiny i Górale mogą wreszcie odbudować swoje osady i żyć bez strachu. Chwała zwycięzcom!',
      ],
    },
  },
  eng: {
    intro: {
      title: 'DARK CASTLE',
      paragraphs: [
        'Hard times have come for the Vikings...\nThe land is terrorized by squads of enforcers from a fortress in the very center of the country. There is no escape from these oppressors.',
        'There is no one to search for here and no trade contacts to make: every tribe in play, the Inhabitants of the Plain and the Highlanders too, is a player and an ally. Only together can you take the fortress!',
        'The Viking tribes can hand people to each other: order a few Vikings to go to the sacred fire of an allied Viking tribe and step into the magical circle of fire. From that moment they obey that ally. The ritual does not take in the Inhabitants of the Plain or the Highlanders.',
        'Tip: You have several building letters. Use them quickly and wisely!',
      ],
    },
    rules: {
      title: 'RAGNARÖK',
      paragraphs: [
        'The fortress does not wait for your attack. Its enforcers raid every tribe on a fixed schedule, stronger each time. There are short breaks between the attacks, so use them well!',
        'From about the middle of the game, attacks also come from the sea: the fortress ships land warriors on your shores.',
        'Over time the enforcers get ever better gear: first better weapons, light armor and shoes, then heavy armor, amulets and finally healing potions.',
        'The fortress garrison grows with time and with the number of tribes in play, and destroyed catapults return to their posts after a while.',
        'The fortress has builders of its own who rebuild what you destroy, and porters who clear the loot off the battlefield.',
        'Gold, iron and mushroom deposits yield three times as much.',
        'The time left until the next attack is shown among your goals.',
      ],
    },
    victory: {
      title: 'VICTORY',
      paragraphs: [
        'The fortress has fallen! The last enforcers lie among the ruins of its walls, and for the first time in years a peaceful day dawns over the land.',
        'Ragnarök did not come. The tribes that stood against the oppressors together held out against attacks from land and sea and took the stronghold with their united strength.',
        'The land is free. The Vikings, the Inhabitants of the Plain and the Highlanders can at last rebuild their villages and live without fear. Glory to the victors!',
      ],
    },
  },
  ger: {
    intro: {
      title: 'FESTUNG',
      paragraphs: [
        'Für die Wikinger sind schwere Zeiten angebrochen...\nDas Land wird von Schlächtertruppen aus einer Festung mitten im Land terrorisiert. Vor diesen Peinigern gibt es kein Entkommen.',
        'Hier muss niemand gesucht und kein Handel geknüpft werden: Alle Stämme im Spiel, auch die Plattländer und die Bergländer, sind Spieler und Verbündete. Nur gemeinsam könnt ihr die Festung einnehmen!',
        'Die Wikingerstämme können einander Leute übergeben: Schicke einige Wikinger zum heiligen Feuer eines verbündeten Wikingerstammes und lasse sie durch den magischen Feuerring schreiten. Von diesem Moment an folgen sie den Befehlen des Verbündeten. Die Plattländer und die Bergländer nehmen an diesem Ritual nicht teil.',
        'Tipp: Du besitzt einige Baubriefe. Nutze sie schnell und klug!',
      ],
    },
    rules: {
      title: 'RAGNARÖK',
      paragraphs: [
        'Die Festung wartet nicht auf euren Angriff. Ihre Schlächter überfallen jeden Stamm nach einem festen Zeitplan, jedes Mal stärker. Zwischen den Angriffen gibt es kurze Pausen, nutze sie gut!',
        'Etwa ab der Mitte des Spiels kommen Angriffe auch vom Meer: Die Schiffe der Festung setzen Krieger an deinen Küsten ab.',
        'Mit der Zeit werden die Schlächter immer besser ausgerüstet: zuerst mit besseren Waffen, leichten Rüstungen und Schuhen, dann mit schweren Rüstungen, Amuletten und schließlich mit Heiltränken.',
        'Die Besatzung der Festung wächst mit der Zeit und mit der Zahl der Stämme im Spiel, und zerstörte Katapulte kehren nach einer Weile an ihren Platz zurück.',
        'Die Festung hat eigene Baumeister, die wieder aufbauen, was du zerstörst, und Träger, die die Beute vom Schlachtfeld räumen.',
        'Gold-, Eisen- und Pilzvorkommen geben dreimal so viel her.',
        'Wie lange es noch bis zum nächsten Angriff dauert, siehst du bei den Missionszielen.',
      ],
    },
    victory: {
      title: 'SIEG',
      paragraphs: [
        'Die Festung ist gefallen! Die letzten Schlächter liegen in den Trümmern ihrer Mauern, und zum ersten Mal seit Jahren bricht über dem Land ein friedlicher Tag an.',
        'Ragnarök ist nicht gekommen. Die Stämme, die sich den Peinigern gemeinsam entgegenstellten, haben den Angriffen zu Land und zu Wasser standgehalten und die Feste mit vereinten Kräften erobert.',
        'Das Land ist frei. Die Wikinger, die Plattländer und die Bergländer können endlich ihre Dörfer wieder aufbauen und ohne Angst leben. Ruhm den Siegern!',
      ],
    },
  },
  rus: {
    intro: {
      title: 'КРЕПОСТЬ',
      paragraphs: [
        'Для Викингов настали тяжелые времена...\nСтрану терроризируют отряды приспешников из крепости в самом центре страны. От этих палачей нет спасения.',
        'Здесь никого не нужно искать и не с кем торговать: все племена в игре, в том числе Жители Равнины и Горцы, являются игроками и союзниками. Только вместе вы сможете взять крепость!',
        'Племена Викингов могут передавать друг другу людей: прикажите нескольким Викингам отправиться к священному огню союзного племени Викингов и переступить магический круг огня. С этого момента они будут слушать приказы союзника. Жителей Равнины и Горцев этот ритуал не касается.',
        'Совет: Вы владеете несколькими разрешениями на строительство. Используйте их быстро и мудро!',
      ],
    },
    rules: {
      title: 'РАГНАРЁК',
      paragraphs: [
        'Крепость не ждёт вашего нападения. Её приспешники нападают на каждое племя по твёрдому расписанию, каждый раз всё сильнее. Между атаками бывают короткие передышки, используйте их с умом!',
        'Примерно с середины игры атаки приходят и с моря: корабли крепости высаживают воинов на Ваших берегах.',
        'Со временем приспешники получают всё лучшее снаряжение: сначала лучшее оружие, лёгкие доспехи и сапоги, затем тяжёлые доспехи, амулеты и, наконец, целебные зелья.',
        'Гарнизон крепости растёт со временем и с числом племён в игре, а разрушенные катапульты через некоторое время возвращаются на свои места.',
        'У крепости есть свои строители, которые восстанавливают то, что Вы разрушили, и носильщики, которые убирают добычу с поля боя.',
        'Залежи золота, железа и грибов дают втрое больше.',
        'Сколько времени осталось до следующей атаки, Вы увидите среди целей миссии.',
      ],
    },
    victory: {
      title: 'ПОБЕДА',
      paragraphs: [
        'Крепость пала! Последние приспешники лежат среди развалин её стен, и впервые за долгие годы над страной встаёт мирный день.',
        'Рагнарёк не наступил. Племена, вместе вставшие против палачей, выдержали атаки с суши и с моря и общими силами взяли твердыню.',
        'Страна свободна. Викинги, Жители Равнины и Горцы наконец могут отстроить свои селения и жить без страха. Слава победителям!',
      ],
    },
  },
  chs: {
    intro: {
      title: '黑暗城堡',
      paragraphs: [
        '对维京人而言，这是个暗无天日的年代……\n来自国土正中央那座要塞的爪牙四处横行，无人能逃过这些暴徒的魔掌。',
        '这里无需寻找任何部族，也没有贸易往来：参战的所有部族，包括普拉特兰人和高地人，都是玩家，也都是盟友。只有齐心协力，才能攻下要塞！',
        '维京部族之间可以互相转交人手：命令几名维京人前往同盟维京部族的圣火，跨过魔法火圈。从此刻起，他们将听从盟友的命令。普拉特兰人和高地人不参与这个仪式。',
        '提示：你手中有几封建筑书信。要尽快明智地使用它们！',
      ],
    },
    rules: {
      title: '诸神黄昏',
      paragraphs: [
        '要塞不会坐等你们来攻。它的爪牙按固定的时间表袭击每个部族，一次比一次猛烈。两次进攻之间只有短暂的间隙，好好利用！',
        '大约从游戏中段起，进攻也会来自海上：要塞的战船会在你的海岸放下战士。',
        '爪牙的装备会随时间越来越好：先是更好的武器、轻甲和鞋子，然后是重甲、护身符，最后是治疗药水。',
        '要塞守军会随着时间和参战部族的数量不断壮大，被摧毁的投石车过一段时间也会回到原处。',
        '要塞有自己的建筑工重建被你摧毁的东西，还有搬运工把战场上的战利品清走。',
        '金矿、铁矿和蘑菇的产量是平常的三倍。',
        '距下一次进攻还有多久，可在任务目标中查看。',
      ],
    },
    victory: {
      title: '胜利',
      paragraphs: [
        '要塞陷落了！最后的爪牙倒在城墙的废墟之间，多年来第一次，这片土地迎来了平静的一天。',
        '诸神黄昏没有降临。携手对抗暴徒的各个部族顶住了来自陆地和海上的进攻，同心协力攻下了这座堡垒。',
        '这片土地自由了。维京人、普拉特兰人和高地人终于可以重建家园，不再生活在恐惧之中。荣耀属于胜利者！',
      ],
    },
  },
  cht: {
    intro: {
      title: '黑暗城堡',
      paragraphs: [
        '對維京人而言，這是個暗無天日的年代……\n來自國土正中央那座要塞的爪牙四處橫行，無人能逃過這些暴徒的魔掌。',
        '這裡無需尋找任何部族，也沒有貿易往來：參戰的所有部族，包括普拉特蘭人和高地人，都是玩家，也都是盟友。只有齊心協力，才能攻下要塞！',
        '維京部族之間可以互相轉交人手：命令幾名維京人前往同盟維京部族的聖火，跨過魔法火圈。從此刻起，他們將聽從盟友的命令。普拉特蘭人和高地人不參與這個儀式。',
        '提示：你手中有幾封建築書信。要盡快明智地使用它們！',
      ],
    },
    rules: {
      title: '諸神黃昏',
      paragraphs: [
        '要塞不會坐等你們來攻。它的爪牙按固定的時間表襲擊每個部族，一次比一次猛烈。兩次進攻之間只有短暫的間隙，好好利用！',
        '大約從遊戲中段起，進攻也會來自海上：要塞的戰船會在你的海岸放下戰士。',
        '爪牙的裝備會隨時間越來越好：先是更好的武器、輕甲和鞋子，然後是重甲、護身符，最後是治療藥水。',
        '要塞守軍會隨著時間和參戰部族的數量不斷壯大，被摧毀的投石車過一段時間也會回到原處。',
        '要塞有自己的建築工重建被你摧毀的東西，還有搬運工把戰場上的戰利品清走。',
        '金礦、鐵礦和蘑菇的產量是平常的三倍。',
        '距下一次進攻還有多久，可在任務目標中查看。',
      ],
    },
    victory: {
      title: '勝利',
      paragraphs: [
        '要塞陷落了！最後的爪牙倒在城牆的廢墟之間，多年來第一次，這片土地迎來了平靜的一天。',
        '諸神黃昏沒有降臨。攜手對抗暴徒的各個部族頂住了來自陸地和海上的進攻，同心協力攻下了這座堡壘。',
        '這片土地自由了。維京人、普拉特蘭人和高地人終於可以重建家園，不再生活在恐懼之中。榮耀屬於勝利者！',
      ],
    },
  },
};

function byLanguage(
  build: (text: LanguageText) => HypertextBlock[],
): Partial<Record<Language, HypertextBlock[]>> {
  const out: Partial<Record<Language, HypertextBlock[]>> = {};
  for (const lang of LANGUAGES) out[lang] = build(TEXTS[lang]);
  return out;
}

/** The opening page tells the story Ragnarök keeps, then its own rules as a section of their own; the
 *  victory page, a copy of the opening one on the authored map, tells the fortress's fall. */
export const SPECJALNA_FORTECA_RAGNAROK_BRIEFING: MapVariantBriefingPages = {
  [OPENING_PAGE]: byLanguage(({ intro, rules }) => [
    blank,
    title(intro.title),
    ...paragraphs(intro.paragraphs),
    sectionGap,
    solemnTitle(rules.title),
    ...paragraphs(rules.paragraphs),
  ]),
  [VICTORY_PAGE]: byLanguage(({ victory }) => [
    blank,
    title(victory.title),
    ...paragraphs(victory.paragraphs),
  ]),
};
