export type Participant = {
  id: string;
  name: string;
  gender: 'nam' | 'nữ';
};

export type IncomeType = 'member' | 'sponsor' | 'advance';

export type Income = {
  id: string;
  participantId: string; // for 'sponsor' or 'advance', this can be empty
  type?: IncomeType;
  targetFund?: string; // 'general' | subGroupId 
  amount: number;
  note: string;
  date: string;
};

export type Expense = {
  id: string;
  description: string;
  amount: number;
  isSponsored: boolean;
  sharedBy: string[]; // array of participantIds
  paidBy?: string; // participantId who paid in advance. empty means paid from general fund
  date: string;
};

export type EstimatedExpense = {
  id: string;
  description: string;
  amount: number;
  unitPrice?: number;
  quantity?: number;
  sharedBy: string[];
  isSponsored?: boolean;
  date: string;
};

export type SubGroup = {
  id: string;
  name: string;
  members: string[]; // participantIds
};

export type RoomType = 'Phòng 2' | 'Phòng 3' | 'Phòng 4' | 'Phòng 6' | 'Phòng 8' | 'Phòng 10' | 'Phòng 12' | 'Phòng tài xế';

export type Room = {
  id: string;
  name: string;
  type: RoomType;
  capacity: number;
  assignedMemberIds: string[];
};

export type Hotel = {
  id: string;
  name: string;
  rooms: Room[];
};

export type FixedGroup = {
  id: string;
  name: string;
  memberIds: string[];
};

export type Trip = {
  name: string;
  startDate: string;
  endDate: string;
  subGroups?: SubGroup[];
  hotels?: Hotel[];
  fixedGroups?: FixedGroup[];
  isLocked?: boolean;
};
