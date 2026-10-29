import type { Language } from '../languages.js';
import type { HypertextBlock } from '../schema/gui/hypertext.js';
import type { MapVariantBriefingAppend } from './schema.js';

/** The `PlayCutscene` page the map's opening mission shows. */
const OPENING_PAGE = 0;

const blank: HypertextBlock = { kind: 'blank', lines: 1 };

/** Laid out like the map's own page: a centred title, then centred paragraphs a blank line apart. */
function section(title: string, paragraphs: readonly string[]): HypertextBlock[] {
  return [
    blank,
    { kind: 'text', style: 'title', text: title, align: 'center' },
    ...paragraphs.flatMap((text): HypertextBlock[] => [
      blank,
      { kind: 'text', style: 'body', text, align: 'center' },
    ]),
  ];
}

/** What Ragnarök changes on Forteca, in the briefing's languages. Times are game time (h:mm); the
 *  numbers follow the variant's escalation and deposit data, which a test holds them to. */
const TEXTS: Record<Language, HypertextBlock[]> = {
  pol: section('RAGNARÖK', [
    'W trybie Ragnarök twierdza sama rusza na wojnę. Atakuje każde plemię według stałego harmonogramu: pierwszy raz o 0:40 czasu gry, a potem coraz silniej, wysyłając 10, 20, 30, a w końcu 60 wojowników. Między atakami są przerwy, wykorzystaj je dobrze!',
    'Od 1:30 co drugi atak nadciąga także od morza: u twoich brzegów przybija statek z 20 wojownikami.',
    'Wojownicy twierdzy z czasem zdobywają lepszy ekwipunek: o 1:00 lekkie zbroje i buty, o 2:00 ciężkie zbroje, o 2:30 amulety, a o 3:00 mikstury lecznicze.',
    'Załoga twierdzy rośnie z upływem czasu i z liczbą plemion w grze, a zniszczone katapulty wracają na swoje miejsca.',
    'Mieszkańcy równiny i Górale są zwykłymi plemionami, którymi można grać. Złoża złota, żelaza i grzybów dają trzy razy więcej.',
    'Ile czasu zostało do następnego ataku, zobaczysz wśród celów misji.',
  ]),
  eng: section('RAGNARÖK', [
    'In Ragnarök mode the fortress goes to war itself. It attacks every tribe on a fixed schedule: first at 0:40 of game time, then harder each time, sending 10, 20, 30 and finally 60 warriors. There are breaks between the attacks, so use them well!',
    'From 1:30 on, every other attack also comes from the sea: a ship with 20 warriors lands on your shore.',
    'The fortress warriors get better gear over time: light armor and shoes at 1:00, heavy armor at 2:00, amulets at 2:30 and healing potions at 3:00.',
    'The fortress garrison grows with time and with the number of tribes in play, and destroyed catapults return to their posts.',
    'The Inhabitants of the Plain and the Highlanders are playable tribes. Gold, iron and mushroom deposits yield three times as much.',
    'The time left until the next attack is shown among your goals.',
  ]),
  ger: section('RAGNARÖK', [
    'Im Modus Ragnarök zieht die Festung selbst in den Krieg. Sie greift jeden Stamm nach einem festen Zeitplan an: zum ersten Mal um 0:40 Spielzeit, danach immer stärker mit 10, 20, 30 und schließlich 60 Kriegern. Zwischen den Angriffen gibt es Pausen, nutze sie gut!',
    'Ab 1:30 kommt jeder zweite Angriff auch vom Meer: An deiner Küste landet ein Schiff mit 20 Kriegern.',
    'Die Krieger der Festung werden mit der Zeit besser ausgerüstet: um 1:00 mit leichten Rüstungen und Schuhen, um 2:00 mit schweren Rüstungen, um 2:30 mit Amuletten und um 3:00 mit Heiltränken.',
    'Die Besatzung der Festung wächst mit der Zeit und mit der Zahl der Stämme im Spiel, und zerstörte Katapulte kehren an ihren Platz zurück.',
    'Die Plattländer und die Bergländer sind spielbare Stämme. Gold-, Eisen- und Pilzvorkommen geben dreimal so viel her.',
    'Wie lange es noch bis zum nächsten Angriff dauert, siehst du bei den Missionszielen.',
  ]),
  rus: section('РАГНАРЁК', [
    'В режиме Рагнарёк крепость сама идёт войной. Она нападает на каждое племя по твёрдому расписанию: впервые в 0:40 игрового времени, а затем всё сильнее, высылая 10, 20, 30 и, наконец, 60 воинов. Между атаками бывают передышки, используйте их с умом!',
    'С 1:30 каждая вторая атака приходит и с моря: к Вашему берегу причаливает корабль с 20 воинами.',
    'Со временем воины крепости получают лучшее снаряжение: в 1:00 лёгкие доспехи и сапоги, в 2:00 тяжёлые доспехи, в 2:30 амулеты, а в 3:00 целебные зелья.',
    'Гарнизон крепости растёт со временем и с числом племён в игре, а разрушенные катапульты возвращаются на свои места.',
    'Жители Равнины и Горцы становятся обычными племенами, за которые можно играть. Залежи золота, железа и грибов дают втрое больше.',
    'Сколько времени осталось до следующей атаки, Вы увидите среди целей миссии.',
  ]),
  chs: section('诸神黄昏', [
    '在诸神黄昏模式中，要塞会主动出击。它按固定的时间表进攻每个部族：第一次在游戏时间 0:40，此后一次比一次猛烈，依次派出 10、20、30 名，最终 60 名战士。两次进攻之间会有喘息之机，好好把握！',
    '从 1:30 起，每隔一次进攻还会有敌人从海上来袭：一艘载着 20 名战士的船会在你的海岸登陆。',
    '要塞战士的装备会随时间越来越好：1:00 获得轻甲和鞋子，2:00 获得重甲，2:30 获得护身符，3:00 获得治疗药水。',
    '要塞守军会随着时间和参战部族的数量不断壮大，被摧毁的投石车也会在原处重新出现。',
    '普拉特兰人和高地人是可以操控的部族。金矿、铁矿和蘑菇的产量是平常的三倍。',
    '距下一次进攻还有多久，可在任务目标中查看。',
  ]),
  cht: section('諸神黃昏', [
    '在諸神黃昏模式中，要塞會主動出擊。它按固定的時間表進攻每個部族：第一次在遊戲時間 0:40，此後一次比一次猛烈，依次派出 10、20、30 名，最終 60 名戰士。兩次進攻之間會有喘息之機，好好把握！',
    '從 1:30 起，每隔一次進攻還會有敵人從海上來襲：一艘載著 20 名戰士的船會在你的海岸登陸。',
    '要塞戰士的裝備會隨時間越來越好：1:00 獲得輕甲和鞋子，2:00 獲得重甲，2:30 獲得護身符，3:00 獲得治療藥水。',
    '要塞守軍會隨著時間和參戰部族的數量不斷壯大，被摧毀的投石車也會在原處重新出現。',
    '普拉特蘭人和高地人是可以操控的部族。金礦、鐵礦和蘑菇的產量是平常的三倍。',
    '距下一次進攻還有多久，可在任務目標中查看。',
  ]),
};

export const SPECJALNA_FORTECA_RAGNAROK_BRIEFING: MapVariantBriefingAppend = {
  pages: [OPENING_PAGE],
  texts: TEXTS,
};
