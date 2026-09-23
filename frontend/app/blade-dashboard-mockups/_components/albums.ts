/**
 * The albums that the Audiobooks browse screen lists (DESIGN.md §6.12).
 *
 * The artwork, the genre and the track listing, with the previews, all
 * come from the iTunes Search API. The key is the `collectionId` of the
 * store, and each album holds the id of its edition.
 *
 * You can set an id by hand from a `music.apple.com` URL, such as
 * `.../album/aquemini/266365274`. This method is more reliable, because
 * the URL names the exact edition and a search can rank another edition
 * first. The deluxe editions and the explicit editions here come from
 * that method. `scripts/fetch-apple-music.mts` resolves the other albums
 * by search one time and reports the ids to paste here. Both methods
 * occur one time: an id is stable, a title search is not, and a
 * dashboard must not search a store at render time.
 *
 * A person maintains this module and it imports nothing. The fetch
 * script reads `ALBUMS` from here, thus an import of the JSON file that
 * the same script writes would make this module depend on its own
 * output. The fetched data is in `album-details.ts`.
 *
 * An album with no id has no artwork and no tracks and keeps the neutral
 * square (§6.2). A row also falls back to that square when its remote
 * artwork does not load.
 */
export interface Album {
  /** The title, as the browse list shows it and sorts it. */
  title: string;
  /**
   * The recording artist. The script uses it to resolve the store id,
   * and the song screen shows it (§6.15). A catch-all row of the console
   * has no artist.
   */
  artist?: string;
  /**
   * The title for the store search, when it is different from the title
   * on the screen. The lists of the console contain sort artefacts that
   * a catalogue cannot match.
   */
  search?: string;
  /**
   * The `collectionId` of the iTunes Store, from the report of the
   * script. It is the key of the artwork, the genre and the track
   * listing with the previews.
   */
  appleId?: number;
}

export const ALBUMS: Album[] = [
  {
    title: "(What's the Story), Morning Glory?",
    artist: "Oasis",
    search: "(What's the Story) Morning Glory?",
    appleId: 1517447039,
  },
  { title: "2001", artist: "Dr. Dre", appleId: 1440782221 },
  { title: "21", artist: "Adele", appleId: 1544491232 },
  { title: "A Flock Of Seagulls", artist: "A Flock of Seagulls", appleId: 1874711518 },
  { title: "A Girl Like Me", artist: "Rihanna", appleId: 1440866306 },
  { title: "A Love Supreme", artist: "John Coltrane", appleId: 1440713018 },
  { title: "A Momentary Lapse of Reason", artist: "Pink Floyd", appleId: 1065974932 },
  { title: "A Night at the Opera", artist: "Queen", appleId: 6781023399 },
  { title: "A Rush of Blood to the Head", artist: "Coldplay", appleId: 1122775993 },
  { title: "Abbey Road", artist: "The Beatles", appleId: 1474815798 },
  { title: "Absolution", artist: "Muse", appleId: 1716096819 },
  { title: "Amantes Sunt Amentes", artist: "PXNDX", appleId: 874977974 },
  { title: "Aquemini", artist: "Outkast", appleId: 266365274 },
  { title: "Aries", artist: "Luis Miguel", appleId: 100986900 },
  { title: "Back in Black", artist: "AC/DC", appleId: 574050396 },
  { title: "Bad", artist: "Michael Jackson", appleId: 559334659 },
  { title: "Blue Lines", artist: "Massive Attack", appleId: 715864097 },
  { title: "Brand New Eyes", artist: "Paramore", appleId: 607337417 },
  {
    title: "CALL ME IF YOU GET LOST: The Estate Sale",
    artist: "Tyler, The Creator",
    appleId: 1679454273,
  },
  { title: "Calle 13", artist: "Calle 13", appleId: 159545628 },
  { title: "Daltónico", artist: "Enjambre", appleId: 727494231 },
  { title: "Dance and Dense Denso", artist: "Molotov", appleId: 1443501304 },
  { title: "DATA", artist: "Tainy", appleId: 1709197767 },
  { title: "Deseo, Carne y Voluntad", artist: "Candelabro", appleId: 1842902072 },
  { title: "Discovery", artist: "Daft Punk", appleId: 697194953 },
  { title: "Dulce Beat", artist: "Belanova", appleId: 1443529658 },
  { title: "Get Rich or Die Tryin'", artist: "50 Cent", appleId: 1440841450 },
  { title: "good kid, m.A.A.d city", artist: "Kendrick Lamar", appleId: 1471264092 },
  { title: "Hybrid Theory", artist: "Linkin Park", appleId: 528436018 },
  { title: "Imaginal Disk", artist: "Magdalena Bay", appleId: 1751414757 },
  { title: "In Rainbows", artist: "Radiohead", appleId: 1109714933 },
  { title: "KID A MNESIA", artist: "Radiohead", appleId: 1581785974 },
  { title: "LA OBSESIÓN, VOL. 1", artist: "Various Artists", appleId: 1846217873 },
  { title: "Lección de Vuelo", artist: "Aleks Syntek", appleId: 713512379 },
  { title: "Limón y Sal", artist: "Julieta Venegas", appleId: 604807962 },
  {
    title: "Más Flow - Los Benjamins",
    artist: "Luny Tunes & Tainy",
    appleId: 1495381353,
  },
  {
    title: "Memo Rex Commander y el Corazón Atómico de la Vía Láctea",
    artist: "ZOE",
    appleId: 1472299930,
  },
  {
    title: "My Beautiful Dark Twisted Fantasy",
    artist: "Kanye West",
    appleId: 1440621197,
  },
  { title: "Nata Montana", artist: "Natanael Cano", appleId: 1694995448 },
  { title: "NEVER ENOUGH", artist: "Turnstile", appleId: 1805820903 },
  {
    title: "NEVER ENOUGH (Bonus Version)",
    artist: "Daniel Caesar",
    appleId: 1681322859,
  },
  { title: "Off the Wall", artist: "Michael Jackson", appleId: 186166282 },
  { title: "Reik", artist: "Reik", appleId: 193651107 },
  { title: "SATURATION II", artist: "BROCKHAMPTON", appleId: 1273819126 },
  { title: "The Diary of Alicia Keys", artist: "Alicia Keys", appleId: 255342344 },
  { title: "The Last Don", artist: "Don Omar", appleId: 1467968644 },
  { title: "The New Abnormal", artist: "The Strokes", appleId: 1498121188 },
  { title: "Thriller", artist: "Michael Jackson", appleId: 269572838 },
  { title: "Turn On the Bright Lights", artist: "Interpol", appleId: 1589272584 },
  { title: "Un Día Normal", artist: "Juanes", appleId: 1440785045 },
  { title: "YHLQMDLG", artist: "Bad Bunny", appleId: 1500776322 },
];

/** The text for the store search. */
export function albumSearchTitle(album: Album): string {
  return album.search ?? album.title;
}
