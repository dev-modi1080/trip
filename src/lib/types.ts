export type User = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  google_drive_refresh_token?: string | null;
};

export type Trip = {
  id: string;
  name: string;
  description: string | null;
  destination: string;
  start_date: string;
  end_date: string;
  cover_image_url: string | null;
  created_by: string;
  invite_code: string;
  google_drive_folder_id?: string | null;
  created_at: string;
};

export type TripMember = {
  trip_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  user?: User;
};

export type Expense = {
  id: string;
  trip_id: string;
  paid_by: string;
  amount: number;
  description: string;
  category:
    | "food"
    | "transport"
    | "accommodation"
    | "activity"
    | "shopping"
    | "other";
  split_type: "EQUAL" | "EXACT" | "PERCENT";
  date: string;
  created_at: string;
  paid_by_user?: User;
  splits?: ExpenseSplit[];
};

export type ExpenseSplit = {
  id: string;
  expense_id: string;
  user_id: string;
  amount_owed: number;
  user?: User;
  is_paid?: boolean;
};

export type Settlement = {
  id: string;
  trip_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  settled_at: string;
  from_user_details?: User;
  to_user_details?: User;
};

export type ItineraryItem = {
  id: string;
  trip_id: string;
  title: string;
  description: string | null;
  location: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  category: "transport" | "activity" | "meal" | "accommodation" | "sightseeing";
  sort_order: number;
  created_by: string;
};

export type TripPhoto = {
  id: string;
  trip_id: string;
  uploaded_by: string;
  file_url: string;
  file_name: string;
  thumbnail_url: string | null;
  uploaded_at: string;
  uploaded_by_user?: User;
};

export type Notification = {
  id: string;
  user_id: string;
  trip_id: string | null;
  type:
    | "expense_added"
    | "settlement"
    | "trip_invite"
    | "itinerary_update"
    | "photo_added";
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
};

// Balance summary for expense calculations
export type BalanceEntry = {
  userId: string;
  user: User;
  totalPaid: number;
  totalOwed: number;
  netBalance: number; // positive = gets money, negative = owes money
};

export type SimplifiedDebt = {
  from: User;
  to: User;
  amount: number;
};

// Form schemas
export type CreateTripForm = {
  name: string;
  description?: string;
  destination: string;
  start_date: string;
  end_date: string;
};

export type AddExpenseForm = {
  description: string;
  amount: number;
  category: Expense["category"];
  split_type: Expense["split_type"];
  paid_by: string;
  date: string;
  split_among: string[];
  custom_splits?: { user_id: string; amount: number }[];
};
