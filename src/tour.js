// Tur durakları. `meshes` = GLB içindeki mesh indeksleri (model malzemeye göre
// birleştirildiği için eşyalar sınır kutularına bakılarak gruplandı).
// `overview: true` olan duraklar evi kuşbakışı gösterir.
// `from: [x, z]` = kameranın nesneye hangi yönden bakacağı (dünya koordinatı);
// verilmezse kamera evin merkezi tarafından bakar.

export const STOPS = [
  {
    id: 'intro',
    overview: true,
    clip: 3.2,
    kicker: 'Milano · Via Boncompagni',
    title: 'Trilocale',
    text: 'Üç odalı bir Milano dairesinin içinde dolaşın. Aşağı kaydırdıkça kamera eve yaklaşır ve odaları tek tek gezer.',
  },
  {
    id: 'plan',
    overview: true,
    clip: 2.05,
    kicker: 'Kat planı',
    title: 'Çatıyı kaldıralım',
    text: 'Tavan kesilince evin tamamı görünür. İşaretlere tıklayarak dilediğiniz eşyaya yakından bakabilirsiniz.',
  },
  {
    id: 'kanepe',
    kicker: 'Oturma köşesi',
    title: 'Yeşil Kanepe',
    text: 'Pencerenin önünde yeşil döşemeli geniş bir kanepe ve yanında boyalı meşe bir dolap.',
    meshes: [11, 16],
  },
  {
    id: 'yemek',
    kicker: 'Yaşam alanı',
    title: 'Yemek Masası',
    text: 'Beton tablalı kare bir masa, meşe ayaklar ve zeytin yeşili deri oturaklar.',
    meshes: [10, 46, 61],
  },
  {
    id: 'mutfak',
    kicker: 'Mutfak',
    title: 'Ocak ve Fırın',
    text: 'Paslanmaz çelik ankastre ocak ve dijital saatli fırın. Beyaz meşe dolaplar tezgah boyunca uzanıyor.',
    meshes: [0, 1, 5, 17, 18, 21],
    from: [-1, -0.35], // ocağın ön yüzü -x yönüne bakıyor
  },
  {
    id: 'tv',
    kicker: 'Yaşam alanı',
    title: 'Televizyon',
    text: 'Mutfak duvarının yanında, yaşam alanına bakan televizyon.',
    meshes: [35],
    from: [-1, 0.35],
  },
  {
    id: 'camasir',
    kicker: 'Islak hacim',
    title: 'Çamaşır Makinesi',
    text: 'Banyonun yanına yerleştirilmiş, füme cam kapaklı önden yüklemeli makine.',
    meshes: [27, 12],
  },
  {
    id: 'banyo',
    kicker: 'Banyo',
    title: 'Mozaik Banyo',
    text: 'Su yeşili mozaik zemin, beyaz duvar karoları, krom armatürler ve klozet.',
    meshes: [22, 28, 63, 68, 49],
  },
  {
    id: 'yatak1',
    kicker: 'Yatak odası',
    title: 'Çocuk Odası',
    text: 'Pencereye yakın, açık renk nevresimli tek kişilik yatak.',
    meshes: [37, 39],
  },
  {
    id: 'yatak2',
    kicker: 'Yatak odası',
    title: 'Ana Yatak Odası',
    text: 'Duvara yaslanmış geniş yatak ve sakin, açık tonlarda bir oda.',
    meshes: [38],
  },
  {
    id: 'outro',
    overview: true,
    clip: 2.05,
    kicker: 'Tur bitti',
    title: 'Keşfetmeye devam',
    text: 'Sağdaki listeden ya da işaretlerden bir eşya seçin; kamerayı fareyle döndürüp yakınlaştırabilirsiniz.',
  },
];
