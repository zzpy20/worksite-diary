export type Entry = {
  id: string;
  user_id: string;
  date: string;
  site: string;
  start_time: string | null;
  finish_time: string | null;
  comments: string | null;
  tasks: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  photo_urls: string[];
  created_at: string;
};

export type NewEntryInput = {
  date: string;
  site: string;
  start_time: string;
  finish_time: string;
  comments: string;
  tasks: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  photoUris: string[];
};
