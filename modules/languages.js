// v7.2 : 11 langues au choix. Français et darija restent les langues d'Abir (voix enregistrées, voix livrées).
// Les autres langues traduisent les mots des cartes de départ, les catégories et les menus principaux,
// et parlent avec la voix du téléphone (aucune connexion nécessaire si la voix est installée).
// Un mot créé ou renommé par le parent reste en français dans les autres langues.

export const LANGS = [
  { code: 'fr', short: 'FR', name: 'Français', flag: '🇫🇷', tts: 'fr-FR' },
  { code: 'dr', short: 'DR', name: 'Darija', flag: '🇲🇦', tts: 'ar-MA' },
  { code: 'ar', short: 'ع', name: 'العربية', flag: '🌙', tts: 'ar-SA', rtl: true },
  { code: 'en', short: 'EN', name: 'English', flag: '🇬🇧', tts: 'en-GB' },
  { code: 'es', short: 'ES', name: 'Español', flag: '🇪🇸', tts: 'es-ES' },
  { code: 'de', short: 'DE', name: 'Deutsch', flag: '🇩🇪', tts: 'de-DE' },
  { code: 'it', short: 'IT', name: 'Italiano', flag: '🇮🇹', tts: 'it-IT' },
  { code: 'pt', short: 'PT', name: 'Português', flag: '🇵🇹', tts: 'pt-PT' },
  { code: 'nl', short: 'NL', name: 'Nederlands', flag: '🇳🇱', tts: 'nl-NL' },
  { code: 'tr', short: 'TR', name: 'Türkçe', flag: '🇹🇷', tts: 'tr-TR' },
  { code: 'zh', short: '中', name: '中文', flag: '🇨🇳', tts: 'zh-CN' },
];

export const langInfo = (code) => LANGS.find((l) => l.code === code) || LANGS[0];
// Langues traduites ici (le français et la darija utilisent les champs des cartes).
const COLUMNS = ['ar', 'en', 'es', 'de', 'it', 'pt', 'nl', 'tr', 'zh'];
export const isExtraLang = (code) => COLUMNS.includes(code);

// français | arabe | anglais | espagnol | allemand | italien | portugais | néerlandais | turc | chinois
const WORDS = `
Je veux|أريد|I want|Quiero|Ich möchte|Voglio|Eu quero|Ik wil|İstiyorum|我要
Oui|نعم|Yes|Sí|Ja|Sì|Sim|Ja|Evet|是
Non|لا|No|No|Nein|No|Não|Nee|Hayır|不
Encore|المزيد|More|Más|Mehr|Ancora|Mais|Meer|Daha|还要
Fini|انتهى|Finished|Terminado|Fertig|Finito|Acabou|Klaar|Bitti|完了
Aide-moi|ساعدني|Help me|Ayúdame|Hilf mir|Aiutami|Ajuda-me|Help me|Yardım et|帮帮我
Attends|انتظر|Wait|Espera|Warte|Aspetta|Espera|Wacht|Bekle|等一下
J'ai mal|أتألم|It hurts|Me duele|Es tut weh|Mi fa male|Dói|Het doet pijn|Acıyor|我疼
Bonjour|مرحبا|Hello|Hola|Hallo|Ciao|Olá|Hallo|Merhaba|你好
Au revoir|مع السلامة|Goodbye|Adiós|Tschüss|Arrivederci|Adeus|Dag|Hoşça kal|再见
Viens jouer|تعال نلعب|Come and play|Ven a jugar|Komm spielen|Vieni a giocare|Vem brincar|Kom spelen|Gel oynayalım|来玩吧
Pain|خبز|Bread|Pan|Brot|Pane|Pão|Brood|Ekmek|面包
Pomme|تفاحة|Apple|Manzana|Apfel|Mela|Maçã|Appel|Elma|苹果
Banane|موزة|Banana|Plátano|Banane|Banana|Banana|Banaan|Muz|香蕉
Gâteau|كعكة|Cake|Pastel|Kuchen|Torta|Bolo|Taart|Pasta|蛋糕
Yaourt|زبادي|Yogurt|Yogur|Joghurt|Yogurt|Iogurte|Yoghurt|Yoğurt|酸奶
Riz|أرز|Rice|Arroz|Reis|Riso|Arroz|Rijst|Pilav|米饭
Biscuit|بسكويت|Cookie|Galleta|Keks|Biscotto|Bolacha|Koekje|Bisküvi|饼干
Œuf|بيضة|Egg|Huevo|Ei|Uovo|Ovo|Ei|Yumurta|鸡蛋
Eau|ماء|Water|Agua|Wasser|Acqua|Água|Water|Su|水
Lait|حليب|Milk|Leche|Milch|Latte|Leite|Melk|Süt|牛奶
Jus|عصير|Juice|Zumo|Saft|Succo|Sumo|Sap|Meyve suyu|果汁
Ballon|كرة|Ball|Pelota|Ball|Palla|Bola|Bal|Top|球
Tablette|جهاز لوحي|Tablet|Tableta|Tablet|Tablet|Tablet|Tablet|Tablet|平板
Dessin animé|رسوم متحركة|Cartoon|Dibujos animados|Zeichentrick|Cartone animato|Desenho animado|Tekenfilm|Çizgi film|动画片
Poupée|دمية|Doll|Muñeca|Puppe|Bambola|Boneca|Pop|Bebek|娃娃
Musique|موسيقى|Music|Música|Musik|Musica|Música|Muziek|Müzik|音乐
Balançoire|أرجوحة|Swing|Columpio|Schaukel|Altalena|Baloiço|Schommel|Salıncak|秋千
Manger|آكل|Eat|Comer|Essen|Mangiare|Comer|Eten|Yemek|吃
Boire|أشرب|Drink|Beber|Trinken|Bere|Beber|Drinken|İçmek|喝
Jouer|ألعب|Play|Jugar|Spielen|Giocare|Brincar|Spelen|Oynamak|玩
Courir|أجري|Run|Correr|Laufen|Correre|Correr|Rennen|Koşmak|跑
Donner|أعطي|Give|Dar|Geben|Dare|Dar|Geven|Vermek|给
Couper|أقطع|Cut|Cortar|Schneiden|Tagliare|Cortar|Knippen|Kesmek|剪
Sauter|أقفز|Jump|Saltar|Springen|Saltare|Saltar|Springen|Zıplamak|跳
Laver|أغسل|Wash|Lavar|Waschen|Lavare|Lavar|Wassen|Yıkamak|洗
Dessiner|أرسم|Draw|Dibujar|Malen|Disegnare|Desenhar|Tekenen|Resim yapmak|画画
Ouvrir|أفتح|Open|Abrir|Öffnen|Aprire|Abrir|Openen|Açmak|打开
Papa|بابا|Dad|Papá|Papa|Papà|Pai|Papa|Baba|爸爸
Maman|ماما|Mum|Mamá|Mama|Mamma|Mãe|Mama|Anne|妈妈
Maîtresse|المعلمة|Teacher|Maestra|Lehrerin|Maestra|Professora|Juf|Öğretmen|老师
Mamie|جدتي|Grandma|Abuela|Oma|Nonna|Avó|Oma|Nine|奶奶
Papi|جدي|Grandpa|Abuelo|Opa|Nonno|Avô|Opa|Dede|爷爷
Toilettes|المرحاض|Toilet|Baño|Toilette|Bagno|Casa de banho|Wc|Tuvalet|厕所
Dormir|أنام|Sleep|Dormir|Schlafen|Dormire|Dormir|Slapen|Uyumak|睡觉
Câlin|عناق|Hug|Abrazo|Umarmung|Abbraccio|Abraço|Knuffel|Sarılmak|抱抱
Bain|حمام|Bath|Baño|Baden|Bagnetto|Banho|Bad|Banyo|洗澡
Changer|أغيّر ملابسي|Change|Cambiarme|Umziehen|Cambiarmi|Mudar de roupa|Omkleden|Üstümü değiştirmek|换衣服
Calme|هادئ|Calm|Tranquila|Ruhig|Calma|Calma|Rustig|Sakin|安静
Content|سعيد|Happy|Feliz|Froh|Contenta|Feliz|Blij|Mutlu|开心
Triste|حزين|Sad|Triste|Traurig|Triste|Triste|Verdrietig|Üzgün|难过
En colère|غاضب|Angry|Enfadada|Wütend|Arrabbiata|Zangada|Boos|Kızgın|生气
Peur|خائف|Scared|Miedo|Angst|Paura|Medo|Bang|Korkmuş|害怕
Fatigué|متعب|Tired|Cansada|Müde|Stanca|Cansada|Moe|Yorgun|累
Fier|فخور|Proud|Orgullosa|Stolz|Orgogliosa|Orgulhosa|Trots|Gururlu|骄傲
Grand|كبير|Big|Grande|Groß|Grande|Grande|Groot|Büyük|大
Petit|صغير|Small|Pequeño|Klein|Piccolo|Pequeno|Klein|Küçük|小
Rouge|أحمر|Red|Rojo|Rot|Rosso|Vermelho|Rood|Kırmızı|红色
Bleu|أزرق|Blue|Azul|Blau|Blu|Azul|Blauw|Mavi|蓝色
Jaune|أصفر|Yellow|Amarillo|Gelb|Giallo|Amarelo|Geel|Sarı|黄色
Vert|أخضر|Green|Verde|Grün|Verde|Verde|Groen|Yeşil|绿色
Chaud|ساخن|Hot|Caliente|Heiß|Caldo|Quente|Warm|Sıcak|热
Froid|بارد|Cold|Frío|Kalt|Freddo|Frio|Koud|Soğuk|冷
Rond|دائري|Round|Redondo|Rund|Rotondo|Redondo|Rond|Yuvarlak|圆
Dehors|خارج البيت|Outside|Afuera|Draußen|Fuori|Lá fora|Buiten|Dışarı|外面
Maison|البيت|Home|Casa|Zuhause|Casa|Casa|Huis|Ev|家
Voiture|سيارة|Car|Coche|Auto|Macchina|Carro|Auto|Araba|汽车
Parc|حديقة|Park|Parque|Park|Parco|Parque|Park|Park|公园
École|المدرسة|School|Escuela|Schule|Scuola|Escola|School|Okul|学校
S'il te plaît|من فضلك|Please|Por favor|Bitte|Per favore|Por favor|Alsjeblieft|Lütfen|请
Merci|شكرا|Thank you|Gracias|Danke|Grazie|Obrigada|Dank je|Teşekkürler|谢谢
C'est quoi ?|ما هذا؟|What is it?|¿Qué es?|Was ist das?|Che cos'è?|O que é?|Wat is dat?|Bu ne?|这是什么？
Où est ?|أين؟|Where is it?|¿Dónde está?|Wo ist es?|Dov'è?|Onde está?|Waar is het?|Nerede?|在哪里？
Avec|مع|With|Con|Mit|Con|Com|Met|İle|和
Lire|أقرأ|Read|Leer|Lesen|Leggere|Ler|Lezen|Okumak|读
Écrire|أكتب|Write|Escribir|Schreiben|Scrivere|Escrever|Schrijven|Yazmak|写
Regarder|أشاهد|Watch|Mirar|Schauen|Guardare|Ver|Kijken|Bakmak|看
Écouter|أستمع|Listen|Escuchar|Hören|Ascoltare|Ouvir|Luisteren|Dinlemek|听
Dans|في|In|Dentro|In|Dentro|Dentro|In|İçinde|里面
Sur|فوق|On|Encima|Auf|Sopra|Em cima|Op|Üstünde|上面
Sous|تحت|Under|Debajo|Unter|Sotto|Debaixo|Onder|Altında|下面
Beaucoup|كثيرا|A lot|Mucho|Viel|Tanto|Muito|Veel|Çok|很多
Un peu|قليلا|A little|Un poco|Ein bisschen|Un po'|Um pouco|Een beetje|Biraz|一点
Moi|أنا|Me|Yo|Ich|Io|Eu|Ik|Ben|我
`;

function norm(text) { return String(text || '').replace(/[’]/g, "'").trim().toLowerCase(); }
const DICT = new Map(WORDS.trim().split('\n').map((line) => {
  const [fr, ...rest] = line.split('|');
  return [norm(fr), Object.fromEntries(COLUMNS.map((code, i) => [code, rest[i]]))];
}));

// Mot d'une carte dans une langue. « Abir (Moi) » : le prénom reste, « Moi » est traduit.
export function cardWord(card, code) {
  if (code === 'dr') return card.dr || card.fr;
  if (!isExtraLang(code)) return card.fr;
  const found = DICT.get(norm(card.fr));
  if (found && found[code]) return found[code];
  const self = /^(.*)\(Moi\)\s*$/.exec(card.fr || '');
  if (self) return `${self[1].trim()} (${DICT.get('moi')[code]})`;
  return card.fr;
}
// Vrai si la carte a une traduction (sinon elle est dite en français).
export const hasWord = (card, code) => !isExtraLang(code) || DICT.has(norm(card.fr)) || /\(Moi\)\s*$/.test(card.fr || '');

// ---------- Catégories et menus ----------
const CATEGORY_NAMES = {
  ar: ['أساسي', 'أكل', 'شرب', 'لعب', 'أفعال', 'أشخاص', 'حاجات', 'مشاعر', 'وصف', 'أماكن'],
  en: ['Basics', 'Eat', 'Drink', 'Play', 'Actions', 'People', 'Needs', 'Feelings', 'Describe', 'Places'],
  es: ['Básico', 'Comer', 'Beber', 'Jugar', 'Acciones', 'Personas', 'Necesidades', 'Emociones', 'Describir', 'Lugares'],
  de: ['Wichtig', 'Essen', 'Trinken', 'Spielen', 'Tun', 'Personen', 'Bedürfnisse', 'Gefühle', 'Beschreiben', 'Orte'],
  it: ['Base', 'Mangiare', 'Bere', 'Giocare', 'Azioni', 'Persone', 'Bisogni', 'Emozioni', 'Descrivere', 'Luoghi'],
  pt: ['Básico', 'Comer', 'Beber', 'Brincar', 'Ações', 'Pessoas', 'Necessidades', 'Emoções', 'Descrever', 'Lugares'],
  nl: ['Basis', 'Eten', 'Drinken', 'Spelen', 'Doen', 'Mensen', 'Behoeften', 'Gevoelens', 'Beschrijven', 'Plaatsen'],
  tr: ['Temel', 'Yemek', 'İçmek', 'Oyun', 'Eylemler', 'Kişiler', 'İhtiyaçlar', 'Duygular', 'Tanımla', 'Yerler'],
  zh: ['常用', '吃', '喝', '玩', '动作', '人', '需要', '情绪', '描述', '地点'],
};
const CATEGORY_ORDER = ['base', 'manger', 'boire', 'jouer', 'actions', 'personnes', 'besoins', 'emotions', 'decrire', 'lieux'];

export function categoryName(category, code) {
  if (code === 'dr') return category.dr || category.fr;
  const i = CATEGORY_ORDER.indexOf(category.id);
  return (CATEGORY_NAMES[code] && i >= 0 && CATEGORY_NAMES[code][i]) || category.fr;
}

// Menus : espaces (barre du bas), tuiles d'accueil, salutation.
const UI = {
  fr: { home: 'Accueil', talk: 'Parler', session: 'Jeux', routines: 'Ma journée', emotions: 'Émotions', progress: 'Progrès', tTalk: 'Je parle', tPlay: 'Je joue', tDay: 'Ma journée', tFeel: 'Mes émotions', sTalk: 'Mes cartes et ma voix', sPlay: 'Les jeux pour apprendre', sDay: 'Ma routine du matin et du soir', sFeel: 'Content, triste, fâché…', hello: 'Bonjour', ask: 'Qu’est-ce qu’on fait aujourd’hui ?' },
  dr: { home: 'Dar', talk: 'Nhder', session: 'L3ab', routines: 'Nhari', emotions: 'Ihsas', progress: 'Taqaddum', tTalk: 'Kanhder', tPlay: 'Kanl3eb', tDay: 'Nhari', tFeel: 'Ihsasati', sTalk: 'Bitaqati w souti', sPlay: 'L3ab bach net3llem', sDay: 'Sba7 w l3chiya', sFeel: 'Fer7ana, 7zina, m3esba…', hello: 'Salam', ask: 'Chnou ghadi ndirou lyoum ?' },
  ar: { home: 'الرئيسية', talk: 'أتكلم', session: 'ألعاب', routines: 'يومي', emotions: 'مشاعر', progress: 'التقدم', tTalk: 'أتكلم', tPlay: 'ألعب', tDay: 'يومي', tFeel: 'مشاعري', sTalk: 'بطاقاتي وصوتي', sPlay: 'ألعاب للتعلم', sDay: 'روتين الصباح والمساء', sFeel: 'سعيد، حزين، غاضب…', hello: 'مرحبا', ask: 'ماذا نفعل اليوم؟' },
  en: { home: 'Home', talk: 'Talk', session: 'Games', routines: 'My day', emotions: 'Feelings', progress: 'Progress', tTalk: 'I talk', tPlay: 'I play', tDay: 'My day', tFeel: 'My feelings', sTalk: 'My cards and my voice', sPlay: 'Games to learn', sDay: 'My morning and evening routine', sFeel: 'Happy, sad, angry…', hello: 'Hello', ask: 'What shall we do today?' },
  es: { home: 'Inicio', talk: 'Hablar', session: 'Juegos', routines: 'Mi día', emotions: 'Emociones', progress: 'Progreso', tTalk: 'Hablo', tPlay: 'Juego', tDay: 'Mi día', tFeel: 'Mis emociones', sTalk: 'Mis tarjetas y mi voz', sPlay: 'Juegos para aprender', sDay: 'Mi rutina de mañana y noche', sFeel: 'Feliz, triste, enfadada…', hello: 'Hola', ask: '¿Qué hacemos hoy?' },
  de: { home: 'Start', talk: 'Sprechen', session: 'Spiele', routines: 'Mein Tag', emotions: 'Gefühle', progress: 'Fortschritt', tTalk: 'Ich spreche', tPlay: 'Ich spiele', tDay: 'Mein Tag', tFeel: 'Meine Gefühle', sTalk: 'Meine Karten und meine Stimme', sPlay: 'Spiele zum Lernen', sDay: 'Mein Morgen und mein Abend', sFeel: 'Froh, traurig, wütend…', hello: 'Hallo', ask: 'Was machen wir heute?' },
  it: { home: 'Home', talk: 'Parlare', session: 'Giochi', routines: 'La mia giornata', emotions: 'Emozioni', progress: 'Progressi', tTalk: 'Parlo', tPlay: 'Gioco', tDay: 'La mia giornata', tFeel: 'Le mie emozioni', sTalk: 'Le mie carte e la mia voce', sPlay: 'Giochi per imparare', sDay: 'La mia mattina e la mia sera', sFeel: 'Contenta, triste, arrabbiata…', hello: 'Ciao', ask: 'Cosa facciamo oggi?' },
  pt: { home: 'Início', talk: 'Falar', session: 'Jogos', routines: 'O meu dia', emotions: 'Emoções', progress: 'Progresso', tTalk: 'Eu falo', tPlay: 'Eu brinco', tDay: 'O meu dia', tFeel: 'As minhas emoções', sTalk: 'Os meus cartões e a minha voz', sPlay: 'Jogos para aprender', sDay: 'A minha manhã e a minha noite', sFeel: 'Feliz, triste, zangada…', hello: 'Olá', ask: 'O que fazemos hoje?' },
  nl: { home: 'Start', talk: 'Praten', session: 'Spelletjes', routines: 'Mijn dag', emotions: 'Gevoelens', progress: 'Vooruitgang', tTalk: 'Ik praat', tPlay: 'Ik speel', tDay: 'Mijn dag', tFeel: 'Mijn gevoelens', sTalk: 'Mijn kaarten en mijn stem', sPlay: 'Spelletjes om te leren', sDay: 'Mijn ochtend en mijn avond', sFeel: 'Blij, verdrietig, boos…', hello: 'Hallo', ask: 'Wat gaan we vandaag doen?' },
  tr: { home: 'Ana sayfa', talk: 'Konuş', session: 'Oyunlar', routines: 'Günüm', emotions: 'Duygular', progress: 'İlerleme', tTalk: 'Konuşuyorum', tPlay: 'Oynuyorum', tDay: 'Günüm', tFeel: 'Duygularım', sTalk: 'Kartlarım ve sesim', sPlay: 'Öğrenmek için oyunlar', sDay: 'Sabahım ve akşamım', sFeel: 'Mutlu, üzgün, kızgın…', hello: 'Merhaba', ask: 'Bugün ne yapalım?' },
  zh: { home: '首页', talk: '说话', session: '游戏', routines: '我的一天', emotions: '情绪', progress: '进度', tTalk: '我说话', tPlay: '我玩', tDay: '我的一天', tFeel: '我的情绪', sTalk: '我的卡片和声音', sPlay: '学习的游戏', sDay: '早上和晚上', sFeel: '开心、难过、生气…', hello: '你好', ask: '今天我们做什么？' },
};
export const ui = (key, code) => (UI[code] && UI[code][key]) || UI.fr[key];
