export type Category = 'Moto' | 'Txopela' | 'Taxi';
export type RideStatus = 'pending' | 'offered' | 'accepted' | 'finished' | 'danger';

export interface Driver {
  id: number;
  name: string;
  phone: string;
  access_key: string;
  category: Category;
  status: 'online' | 'offline';
  photo?: string;
  total_commission?: number;
  total_rides?: number;
}

export interface Ride {
  id: number;
  client_name: string;
  client_phone?: string;
  client_avg_rating?: number;
  pickup: string;
  destination: string;
  category: Category;
  status: RideStatus;
  driver_id?: number;
  driver_name?: string;
  driver_phone?: string;
  final_price?: number;
  admin_fee?: number;
  client_rating?: number;
  client_comment?: string;
  driver_rating?: number;
  driver_comment?: string;
  created_at: string;
  client_avg_rating_val?: number; // Added to match server query
  settled?: number;
}

export interface Offer {
  id: number;
  ride_id: number;
  driver_id: number;
  driver_name: string;
  driver_category: Category;
  driver_photo?: string;
  price: number;
  avg_rating?: number;
  counter_price?: number;
  created_at: string;
}

export interface Message {
  id: number;
  ride_id: number;
  sender_role: 'client' | 'driver';
  text: string;
  timestamp: string;
}
