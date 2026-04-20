export type Visibility = 'private' | 'friends' | 'public';
export type TripStatus = 'unstarted' | 'traveling' | 'closed';

export type UserProfile = {
  id: string;
  username: string;
  email?: string;
  bio?: string;
  avatar_url?: string;
  visibility: Visibility;
  created_at?: string;
};

export type TripLeg = {
  id?: string;
  trip_id?: string;
  order_index: number;
  location_name: string;
  lat: number;
  lng: number;
  start_time: string;
  caption?: string;
  media_urls: string[];
  like_count?: number;
  liked_by_viewer?: boolean;
};

export type Trip = {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_location_name: string;
  start_lat: number;
  start_lng: number;
  status: TripStatus;
  visibility: Visibility;
  created_at?: string;
  legs: TripLeg[];
  like_count?: number;
  liked_by_viewer?: boolean;
};

export type FriendRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
};

export type FriendUser = {
  id: string;
  username: string;
  avatar_url?: string;
};