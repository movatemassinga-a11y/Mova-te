export type Category = 'Moto' | 'Txopela' | 'Taxi';
export type RideStatus = 'pending' | 'offered' | 'accepted' | 'finished' | 'danger';

export interface Driver {
  id: number;
  name: string;
  phone: string;
  access_key: string;
  category: Category;
  status: 'online' | 'offline';
  total_commission?: number;
  total_rides?: number;
}

export interface Ride {
  id: number;
  client_name: string;
  client_phone?: string;
  pickup: string;
  destination: string;
  category: Category;
  status: RideStatus;
  driver_id?: number;
  driver_name?: string;
  driver_phone?: string;
  final_price?: number;
  admin_fee?: number;
  created_at: string;
}

export interface Offer {
  id: number;
  ride_id: number;
  driver_id: number;
  driver_name: string;
  driver_category: Category;
  price: number;
  created_at: string;
}

export interface Message {
  id: number;
  ride_id: number;
  sender_role: 'client' | 'driver';
  text: string;
  timestamp: string;
}
