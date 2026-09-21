/**
 * The albums the Audiobooks browse screen lists (DESIGN.md §6.12).
 *
 * Artwork, genre and the track listing - previews included - all come
 * from the **iTunes Search API**, which is keyed by the store's
 * `collectionId`. Each album carries the id of the edition to use.
 *
 * An id can be pinned by hand straight from a `music.apple.com` URL -
 * `.../album/aquemini/266365274` - which is the surer route, because it
 * names the exact edition instead of trusting a search to rank it first;
 * that is how the deluxe and explicit editions here were chosen.
 * `scripts/fetch-apple-music.mts` resolves the rest by search once and
 * reports the ids to paste. Either way it is a one-off: an id is stable,
 * a title search is not, and a dashboard should not be searching a store
 * at render time.
 *
 * This module is hand-maintained and deliberately imports nothing: the
 * fetch script reads `ALBUMS` from here, so pulling in the JSON file that
 * same script writes would make it depend on its own output. The fetched
 * half lives in `album-details.ts`.
 *
 * An album with no id has no artwork and no tracks, and keeps the neutral
 * square (§6.2) - which is also what a row falls back to when its remote
 * artwork fails to load.
 */
export interface Album {
  /** Title as the browse list shows and sorts it. */
  title: string;
  /**
   * Recording artist. Used to resolve the store id, and shown on the song
   * screen (§6.15). Absent on the console's catch-all rows.
   */
  artist?: string;
  /**
   * Title to search the store with, when it differs from the displayed
   * one. The console's lists carry sort artefacts a catalogue will not
   * match.
   */
  search?: string;
  /**
   * iTunes Store `collectionId`, filled in from the script's report. It
   * keys the artwork, the genre and the track listing with its previews.
   */
  appleId?: number;
}

export const ALBUMS: Album[] = [
  // The console's catch-all for untagged files. No artist, so no art.
  { title: "Unknown Album" },
  // Deliberately unresolved: "#3" matches several unrelated records and
  // the list gives no artist to disambiguate it - a store search for it
  // returns Ella Mai and Lukas Graham. Guessing would put the wrong
  // sleeve on the shelf, so it keeps the placeholder.
  { title: "#3" },
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
  { title: "A Momentary Lapse of Reason", artist: "Pink Floyd", appleId: 1065974932 },
  { title: "A Night at the Opera", artist: "Queen", appleId: 6781023399 },
  { title: "A Rush of Blood to the Head", artist: "Coldplay", appleId: 1122775993 },
  { title: "Abbey Road", artist: "The Beatles", appleId: 1474815798 },
  { title: "Absolution", artist: "Muse", appleId: 1716096819 },
  { title: "Aquemini", artist: "Outkast", appleId: 266365274 },
  { title: "Aries", artist: "Luis Miguel", appleId: 100986900 },
  { title: "Back in Black", artist: "AC/DC", appleId: 574050396 },
  { title: "Blue Lines", artist: "Massive Attack", appleId: 715864097 },
  {
    title: "CALL ME IF YOU GET LOST: The Estate Sale",
    artist: "Tyler, The Creator",
    appleId: 1679454273,
  },
  { title: "Daltónico", artist: "Enjambre", appleId: 727494231 },
  { title: "Discovery", artist: "Daft Punk", appleId: 697194953 },
  { title: "Get Rich or Die Tryin'", artist: "50 Cent", appleId: 1440841450 },
  { title: "good kid, m.A.A.d city", artist: "Kendrick Lamar", appleId: 1471264092 },
  { title: "Hybrid Theory", artist: "Linkin Park", appleId: 528436018 },
  { title: "Imaginal Disk", artist: "Magdalena Bay", appleId: 1751414757 },
  {
    title: "My Beautiful Dark Twisted Fantasy",
    artist: "Kanye West",
    appleId: 1440621197,
  },
  { title: "NEVER ENOUGH", artist: "Turnstile", appleId: 1805820903 },
];

/** What to search the store with. */
export function albumSearchTitle(album: Album): string {
  return album.search ?? album.title;
}
