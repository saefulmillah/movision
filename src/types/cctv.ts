export interface Camera {
  id: number;
  cctv_name: string;
  cctv_desc: string | null;
  stream_play_url: string | null;
  antmedia_id?: string | null;
  branch_id: number;
  branch_code?: string;
  branch_name?: string;
  is_active: number;
  cctv_lat?: number;
  cctv_lon?: number;
  information?: string | null;
}
