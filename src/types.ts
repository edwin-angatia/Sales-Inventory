import { Timestamp } from 'firebase/firestore';

export const REBOOTLY_LOGO_URL =
  '/assets/aistudio/WhatsApp_Image_2026-11-18_at_16.04.40_93e5f1dc.jpeg';

export const ELECTRONICS_CATEGORIES = [
  'Smartphones',
  'Laptops',
  'Audio',
  'Displays',
  'Components',
  'Accessories',
  'Gaming',
  'Other',
] as const;

export type ElectronicsCategory = (typeof ELECTRONICS_CATEGORIES)[number];

export type UnitStatus = 'in_stock' | 'sold' | 'returned' | 'damaged';
export type SaleChannel = 'in_store' | 'whatsapp' | 'online' | 'marketplace';
export type PaymentMethod = 'mpesa' | 'cash' | 'card' | 'bank_transfer';

export const CHANNEL_LABELS: Record<SaleChannel, string> = {
  in_store: 'In-Store',
  whatsapp: 'WhatsApp',
  online: 'Online Store',
  marketplace: 'Marketplace',
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  mpesa: 'M-Pesa',
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
};

export interface Product {
  id: string;
  ownerId: string;
  name: string;
  brand: string;
  model?: string;
  sku: string;
  barcode?: string;
  category: ElectronicsCategory;
  costPrice: number;
  sellPrice: number;
  reorderThreshold: number;
  supplierId?: string;
  supplierName?: string;
  status: 'active' | 'archived';
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Unit {
  id: string;
  ownerId: string;
  productId: string;
  serialNumber: string;
  status: UnitStatus;
  costSnapshot: number;
  receivedAt?: Timestamp;
  soldAt?: Timestamp | null;
  saleId?: string | null;
  warrantyExpiry?: string;
  updatedAt?: Timestamp;
}

export const VAT_RATE = 0.16;

export interface Sale {
  id: string;
  ownerId: string;
  soldBy: string;
  channel: SaleChannel;
  paymentMethod: PaymentMethod;
  customerName?: string;
  customerPhone?: string;
  subtotal?: number;
  vatAmount?: number;
  totalAmount: number;
  totalProfit: number;
  itemCount: number;
  status: 'completed' | 'returned';
  soldAt?: Timestamp;
}

export interface SaleItem {
  id: string;
  ownerId: string;
  saleId: string;
  unitId: string;
  productId: string;
  productName: string;
  sku: string;
  serialNumber: string;
  priceAtSale: number;
  costAtSale: number;
  createdAt?: Timestamp;
}

export interface Supplier {
  id: string;
  ownerId: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  leadTimeDays: number;
  status: 'active' | 'inactive';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface RestockOrder {
  id: string;
  ownerId: string;
  supplierId?: string;
  supplierName: string;
  estimatedLeadDays: number;
  actualLeadDays: number;
  unitCount: number;
  orderedDate: string;
  receivedDate: string;
  createdAt?: Timestamp;
}

export interface UserProfile {
  id: string;
  uid: string;
  displayName?: string;
  email: string;
  role: 'admin' | 'staff';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

export function getStockStatus(inStockCount: number, reorderThreshold: number): StockStatus {
  if (inStockCount <= 0) return 'out-of-stock';
  if (inStockCount <= reorderThreshold) return 'low-stock';
  return 'in-stock';
}

export function formatKES(amount: number): string {
  return `KES ${new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

export interface ProductFormInput {
  name: string;
  brand: string;
  model: string;
  sku: string;
  barcode: string;
  category: ElectronicsCategory;
  costPrice: number;
  sellPrice: number;
  reorderThreshold: number;
  supplierName: string;
  notes: string;
  initialSerials: string;
}

export const SAMPLE_SUPPLIERS = [
  {
    name: 'Mombasa Road Tech Distributors',
    contactName: 'James Mwangi',
    phone: '+254 712 345 678',
    email: 'orders@mrtech.co.ke',
    leadTimeDays: 2,
  },
  {
    name: 'Nairobi Digital Wholesale',
    contactName: 'Amina Hassan',
    phone: '+254 722 987 654',
    email: 'supply@nairobidigital.co.ke',
    leadTimeDays: 3,
  },
  {
    name: 'East Africa Mobile Hub',
    contactName: 'David Ochieng',
    phone: '+254 733 456 123',
    email: 'b2b@eamobilehub.co.ke',
    leadTimeDays: 5,
  },
];

export const SAMPLE_PRODUCTS = [
  {
    name: 'iPhone 16 Pro 256GB Titanium',
    brand: 'Apple',
    model: 'A3293',
    sku: 'APL-IP16P-256',
    barcode: '195949722101',
    category: 'Smartphones' as ElectronicsCategory,
    costPrice: 132000,
    sellPrice: 158000,
    reorderThreshold: 2,
    supplierName: 'East Africa Mobile Hub',
    notes: '1-year AppleCare warranty',
    serials: ['IMEI-35901122334401', 'IMEI-35901122334402', 'IMEI-35901122334403'],
  },
  {
    name: 'Galaxy S25 Ultra 512GB',
    brand: 'Samsung',
    model: 'SM-S938B',
    sku: 'SAM-S25U-512',
    barcode: '880609588412',
    category: 'Smartphones' as ElectronicsCategory,
    costPrice: 142000,
    sellPrice: 169500,
    reorderThreshold: 2,
    supplierName: 'East Africa Mobile Hub',
    notes: 'Fast mover — low stock',
    serials: ['IMEI-35449988776601'],
  },
  {
    name: 'MacBook Air 15" M4 16GB/512GB',
    brand: 'Apple',
    model: 'MC9G4LL/A',
    sku: 'APL-MBA15-M4',
    barcode: '195949881234',
    category: 'Laptops' as ElectronicsCategory,
    costPrice: 168000,
    sellPrice: 198000,
    reorderThreshold: 2,
    supplierName: 'Nairobi Digital Wholesale',
    notes: 'Backroom cabinet B2',
    serials: ['SN-C02YM4001A', 'SN-C02YM4002B'],
  },
  {
    name: 'WH-1000XM5 Wireless Headphones',
    brand: 'Sony',
    model: 'WH1000XM5/B',
    sku: 'SNY-XM5-BLK',
    barcode: '027242923232',
    category: 'Audio' as ElectronicsCategory,
    costPrice: 34000,
    sellPrice: 44500,
    reorderThreshold: 3,
    supplierName: 'Mombasa Road Tech Distributors',
    notes: 'Black colorway',
    serials: ['SN-XM5-90811', 'SN-XM5-90812'],
  },
  {
    name: 'UltraGear 27" 240Hz OLED Monitor',
    brand: 'LG',
    model: '27GR95QE-B',
    sku: 'LG-27GR95QE',
    barcode: '195174051900',
    category: 'Displays' as ElectronicsCategory,
    costPrice: 78000,
    sellPrice: 96000,
    reorderThreshold: 2,
    supplierName: 'Mombasa Road Tech Distributors',
    notes: 'Out of stock — reorder urgently',
    serials: [],
  },
  {
    name: 'Anker Prime 100W GaN Charger',
    brand: 'Anker',
    model: 'A2343',
    sku: 'ANK-100W-GAN',
    barcode: '194644139209',
    category: 'Accessories' as ElectronicsCategory,
    costPrice: 5200,
    sellPrice: 8500,
    reorderThreshold: 4,
    supplierName: 'Nairobi Digital Wholesale',
    notes: 'Checkout counter display',
    serials: [
      'SN-ANK100-01',
      'SN-ANK100-02',
      'SN-ANK100-03',
      'SN-ANK100-04',
      'SN-ANK100-05',
    ],
  },
];
