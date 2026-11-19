import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  AlertCircle,
  Archive,
  Barcode,
  Boxes,
  Check,
  CheckCircle2,
  Download,
  LogOut,
  Menu,
  PackagePlus,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
  Truck,
  X,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  CHANNEL_LABELS,
  ELECTRONICS_CATEGORIES,
  formatKES,
  getStockStatus,
  PAYMENT_LABELS,
  PaymentMethod,
  Product,
  ProductFormInput,
  REBOOTLY_LOGO_URL,
  RestockOrder,
  Sale,
  SaleChannel,
  SaleItem,
  SAMPLE_PRODUCTS,
  SAMPLE_SUPPLIERS,
  StockStatus,
  Supplier,
  Unit,
  UnitStatus,
} from './types';
import { AuthGate } from './components/AuthGate';
import { GoalAttainmentModal } from './components/GoalAttainmentModal';
import { ItemModal } from './components/ItemModal';
import { MonthlyRevenueChart } from './components/MonthlyRevenueChart';
import { PWAInstallButton } from './components/PWAInstallButton';
import { RestockModal } from './components/RestockModal';
import { SalesRevenueChart } from './components/SalesRevenueChart';
import { SellUnitModal } from './components/SellUnitModal';
import { SupplierPerformance } from './components/SupplierPerformance';
import { useOnlineStatus } from './hooks/usePWAInstall';
import { playDropcoinTone } from './utils/sound';

type NavView = 'inventory' | 'units' | 'restock' | 'sales' | 'suppliers';

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'staff'>('admin');

  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [restockOrders, setRestockOrders] = useState<RestockOrder[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [activeView, setActiveView] = useState<NavView>('inventory');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Inventory filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | StockStatus>('all');

  // Units filters
  const [unitSearch, setUnitSearch] = useState('');
  const [unitStatusFilter, setUnitStatusFilter] = useState<'all' | UnitStatus>('all');

  // Sales filters
  const [salesSearch, setSalesSearch] = useState('');
  const [salesChannelFilter, setSalesChannelFilter] = useState<'all' | SaleChannel>('all');
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<'all' | PaymentMethod>('all');

  // Modals
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [sellProduct, setSellProduct] = useState<Product | null>(null);

  // Supplier quick-add form
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierContact, setNewSupplierContact] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierLead, setNewSupplierLead] = useState(3);
  const [savingSupplier, setSavingSupplier] = useState(false);

  const [seeding, setSeeding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    const saved = localStorage.getItem('rebootly_daily_revenue_goal');
    const parsed = saved ? Number(saved) : 150000;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 150000;
  });
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(dailyGoal));
  const [goalModalOpen, setGoalModalOpen] = useState(false);

  // Auth listener & user profile registration
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) {
        setProducts([]);
        setUnits([]);
        setSales([]);
        setSaleItems([]);
        setSuppliers([]);
        setLoadingData(false);
        return;
      }

      try {
        const profileRef = doc(db, 'users', currentUser.uid);
        const snap = await getDoc(profileRef);
        if (!snap.exists()) {
          await setDoc(profileRef, {
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'Store Manager',
            email: currentUser.email || '',
            role: 'admin',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setUserRole('admin');
        } else {
          const data = snap.data();
          setUserRole(data.role === 'staff' ? 'staff' : 'admin');
        }
      } catch (err) {
        console.error('User profile sync error:', err);
      }
    });
    return () => unsub();
  }, []);

  // Real-time Firestore listeners for all collections
  useEffect(() => {
    if (!authReady || !user) return;
    setLoadingData(true);

    let loaded = 0;
    const checkDone = () => {
      loaded += 1;
      if (loaded >= 5) setLoadingData(false);
    };

    const unsubProducts = onSnapshot(
      query(collection(db, 'products'), where('ownerId', '==', user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Product, 'id'>),
        }));
        list.sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
        setProducts(list);
        checkDone();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'products')
    );

    const unsubUnits = onSnapshot(
      query(collection(db, 'units'), where('ownerId', '==', user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Unit, 'id'>),
        }));
        list.sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
        setUnits(list);
        checkDone();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'units')
    );

    const unsubSales = onSnapshot(
      query(collection(db, 'sales'), where('ownerId', '==', user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Sale, 'id'>),
        }));
        list.sort((a, b) => (b.soldAt?.toMillis?.() ?? 0) - (a.soldAt?.toMillis?.() ?? 0));
        setSales(list);
        checkDone();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'sales')
    );

    const unsubSaleItems = onSnapshot(
      query(collection(db, 'sale_items'), where('ownerId', '==', user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SaleItem, 'id'>),
        }));
        setSaleItems(list);
        checkDone();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'sale_items')
    );

    const unsubSuppliers = onSnapshot(
      query(collection(db, 'suppliers'), where('ownerId', '==', user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Supplier, 'id'>),
        }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setSuppliers(list);
        checkDone();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'suppliers')
    );

    const unsubRestockOrders = onSnapshot(
      query(collection(db, 'restock_orders'), where('ownerId', '==', user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<RestockOrder, 'id'>),
        }));
        setRestockOrders(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'restock_orders')
    );

    return () => {
      unsubProducts();
      unsubUnits();
      unsubSales();
      unsubSaleItems();
      unsubSuppliers();
      unsubRestockOrders();
    };
  }, [authReady, user]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // Derived maps: stock count is ALWAYS derived from in_stock units, never stored
  const activeProducts = useMemo(
    () => products.filter((p) => p.status === 'active'),
    [products]
  );

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  const unitsByProduct = useMemo(() => {
    const map = new Map<string, { inStock: Unit[]; soldCount: number }>();
    for (const u of units) {
      const entry = map.get(u.productId) || { inStock: [], soldCount: 0 };
      if (u.status === 'in_stock') entry.inStock.push(u);
      if (u.status === 'sold') entry.soldCount += 1;
      map.set(u.productId, entry);
    }
    return map;
  }, [units]);

  const saleItemsBySale = useMemo(() => {
    const map = new Map<string, SaleItem[]>();
    for (const si of saleItems) {
      const arr = map.get(si.saleId) || [];
      arr.push(si);
      map.set(si.saleId, arr);
    }
    return map;
  }, [saleItems]);

  // Derived store metrics
  const metrics = useMemo(() => {
    let totalInStockUnits = 0;
    let inventoryValue = 0;
    let restockCount = 0;
    let outOfStockCount = 0;

    for (const p of activeProducts) {
      const count = unitsByProduct.get(p.id)?.inStock.length ?? 0;
      totalInStockUnits += count;
      inventoryValue += count * p.sellPrice;
      if (count <= p.reorderThreshold) restockCount += 1;
      if (count === 0) outOfStockCount += 1;
    }

    const completedSales = sales.filter((s) => s.status === 'completed');
    const totalRevenue = completedSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalProfit = completedSales.reduce((sum, s) => sum + s.totalProfit, 0);
    const totalSoldUnits = completedSales.reduce((sum, s) => sum + s.itemCount, 0);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRevenue = completedSales.reduce((sum, s) => {
      const d = s.soldAt?.toDate ? s.soldAt.toDate() : null;
      return d && d >= todayStart ? sum + s.totalAmount : sum;
    }, 0);

    return {
      totalInStockUnits,
      inventoryValue,
      restockCount,
      outOfStockCount,
      totalRevenue,
      totalProfit,
      totalSoldUnits,
      todayRevenue,
    };
  }, [activeProducts, unitsByProduct, sales]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeProducts.filter((p) => {
      const stock = unitsByProduct.get(p.id)?.inStock.length ?? 0;
      const status = getStockStatus(stock, p.reorderThreshold);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.supplierName || '').toLowerCase().includes(q)
      );
    });
  }, [activeProducts, unitsByProduct, searchQuery, categoryFilter, statusFilter]);

  // Restock queue
  const restockQueue = useMemo(() => {
    return activeProducts
      .map((p) => ({
        product: p,
        stock: unitsByProduct.get(p.id)?.inStock.length ?? 0,
      }))
      .filter((entry) => entry.stock <= entry.product.reorderThreshold)
      .sort((a, b) => a.stock - b.stock);
  }, [activeProducts, unitsByProduct]);

  // Filtered units
  const filteredUnits = useMemo(() => {
    const q = unitSearch.trim().toLowerCase();
    return units.filter((u) => {
      if (unitStatusFilter !== 'all' && u.status !== unitStatusFilter) return false;
      if (!q) return true;
      const prod = productById.get(u.productId);
      return (
        u.serialNumber.toLowerCase().includes(q) ||
        (prod?.name.toLowerCase().includes(q) ?? false) ||
        (prod?.sku.toLowerCase().includes(q) ?? false) ||
        (prod?.barcode?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [units, unitSearch, unitStatusFilter, productById]);

  // Filtered sales (used by both Sales Log table and Export to CSV)
  const filteredSales = useMemo(() => {
    const q = salesSearch.trim().toLowerCase();
    return sales.filter((s) => {
      if (salesChannelFilter !== 'all' && s.channel !== salesChannelFilter) return false;
      if (salesPaymentFilter !== 'all' && s.paymentMethod !== salesPaymentFilter) return false;
      if (!q) return true;
      const items = saleItemsBySale.get(s.id) || [];
      const itemMatch = items.some(
        (i) =>
          i.productName.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          i.serialNumber.toLowerCase().includes(q)
      );
      return (
        itemMatch ||
        (s.customerName || '').toLowerCase().includes(q) ||
        (s.customerPhone || '').toLowerCase().includes(q) ||
        s.soldBy.toLowerCase().includes(q)
      );
    });
  }, [sales, salesSearch, salesChannelFilter, salesPaymentFilter, saleItemsBySale]);

  // Export filtered sales to CSV
  const handleExportSalesCsv = () => {
    const headers = [
      'Sale ID',
      'Date',
      'Status',
      'Product',
      'SKU',
      'Serial/IMEI',
      'Channel',
      'Payment Method',
      'Customer',
      'Customer Phone',
      'Sold By',
      'Total (KES)',
      'Cost Snapshot (KES)',
      'Net Profit/Loss (KES)',
      'Outcome',
    ];

    const rows: string[][] = [];
    for (const sale of filteredSales) {
      const dateStr = sale.soldAt?.toDate ? sale.soldAt.toDate().toISOString() : '';
      const lineItems = saleItemsBySale.get(sale.id) || [];
      const outcome =
        sale.totalProfit > 0 ? 'Profit' : sale.totalProfit < 0 ? 'Loss' : 'Break-even';

      if (lineItems.length > 0) {
        for (const li of lineItems) {
          const itemProfit = li.priceAtSale - li.costAtSale;
          const itemOutcome = itemProfit > 0 ? 'Profit' : itemProfit < 0 ? 'Loss' : 'Break-even';
          rows.push([
            sale.id,
            dateStr,
            sale.status,
            li.productName,
            li.sku,
            li.serialNumber,
            CHANNEL_LABELS[sale.channel] || sale.channel,
            PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod,
            sale.customerName || '',
            sale.customerPhone || '',
            sale.soldBy,
            String(li.priceAtSale),
            String(li.costAtSale),
            String(itemProfit),
            itemOutcome,
          ]);
        }
      } else {
        rows.push([
          sale.id,
          dateStr,
          sale.status,
          '',
          '',
          '',
          CHANNEL_LABELS[sale.channel] || sale.channel,
          PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod,
          sale.customerName || '',
          sale.customerPhone || '',
          sale.soldBy,
          String(sale.totalAmount),
          String(sale.totalAmount - sale.totalProfit),
          String(sale.totalProfit),
          outcome,
        ]);
      }
    }

    const csvContent = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((r) => r.map(escapeCsvCell).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `rebootly-sales-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setToast(`Exported ${filteredSales.length} sale record${filteredSales.length === 1 ? '' : 's'} to CSV.`);
  };

  // Handlers
  const handleSaveProduct = async (data: ProductFormInput, existingId?: string) => {
    if (!user) return;
    if (existingId) {
      const ref = doc(db, 'products', existingId);
      try {
        await updateDoc(ref, {
          name: data.name,
          brand: data.brand,
          model: data.model,
          sku: data.sku,
          barcode: data.barcode,
          category: data.category,
          costPrice: Number(data.costPrice),
          sellPrice: Number(data.sellPrice),
          reorderThreshold: Number(data.reorderThreshold),
          supplierName: data.supplierName,
          notes: data.notes,
          updatedAt: serverTimestamp(),
        });
        setToast(`Updated ${data.name}`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `products/${existingId}`);
      }
    } else {
      try {
        const batch = writeBatch(db);
        const productRef = doc(collection(db, 'products'));
        batch.set(productRef, {
          ownerId: user.uid,
          name: data.name,
          brand: data.brand,
          model: data.model,
          sku: data.sku,
          barcode: data.barcode,
          category: data.category,
          costPrice: Number(data.costPrice),
          sellPrice: Number(data.sellPrice),
          reorderThreshold: Number(data.reorderThreshold),
          supplierName: data.supplierName,
          status: 'active',
          notes: data.notes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const serials = data.initialSerials
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);

        for (const serial of serials) {
          const unitRef = doc(collection(db, 'units'));
          batch.set(unitRef, {
            ownerId: user.uid,
            productId: productRef.id,
            serialNumber: serial.slice(0, 80),
            status: 'in_stock',
            costSnapshot: Number(data.costPrice),
            receivedAt: serverTimestamp(),
            soldAt: null,
            saleId: null,
            warrantyExpiry: '',
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
        setToast(
          `Created ${data.name}${serials.length > 0 ? ` with ${serials.length} serialized unit(s)` : ''}.`
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'products');
      }
    }
  };

  const handleArchiveProduct = async (product: Product) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'products', product.id), {
        status: 'archived',
        updatedAt: serverTimestamp(),
      });
      setToast(`Archived ${product.name} (preserved in audit history).`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${product.id}`);
    }
  };

  const handleReceiveUnits = async (
    product: Product,
    serialNumbers: string[],
    costSnapshot: number,
    warrantyExpiry: string
  ) => {
    if (!user || serialNumbers.length === 0) return;
    try {
      const batch = writeBatch(db);
      for (const serial of serialNumbers) {
        const unitRef = doc(collection(db, 'units'));
        batch.set(unitRef, {
          ownerId: user.uid,
          productId: product.id,
          serialNumber: serial.slice(0, 80),
          status: 'in_stock',
          costSnapshot: Number(costSnapshot),
          receivedAt: serverTimestamp(),
          soldAt: null,
          saleId: null,
          warrantyExpiry: warrantyExpiry.slice(0, 40),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      setToast(`Received ${serialNumbers.length} unit(s) for ${product.name}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'units');
    }
  };

  const handleConfirmSale = async ({
    product,
    unit,
    priceAtSale,
    channel,
    paymentMethod,
    customerName,
    customerPhone,
  }: {
    product: Product;
    unit: Unit;
    priceAtSale: number;
    channel: SaleChannel;
    paymentMethod: PaymentMethod;
    customerName: string;
    customerPhone: string;
  }) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      const saleRef = doc(collection(db, 'sales'));
      const saleItemRef = doc(collection(db, 'sale_items'));
      const unitRef = doc(db, 'units', unit.id);

      const profit = Number((priceAtSale - unit.costSnapshot).toFixed(2));

      batch.set(saleRef, {
        ownerId: user.uid,
        soldBy: user.displayName || user.email || 'Staff',
        channel,
        paymentMethod,
        customerName: customerName.slice(0, 100),
        customerPhone: customerPhone.slice(0, 40),
        totalAmount: Number(priceAtSale),
        totalProfit: profit,
        itemCount: 1,
        status: 'completed',
        soldAt: serverTimestamp(),
      });

      batch.set(saleItemRef, {
        ownerId: user.uid,
        saleId: saleRef.id,
        unitId: unit.id,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        serialNumber: unit.serialNumber,
        priceAtSale: Number(priceAtSale),
        costAtSale: Number(unit.costSnapshot),
        createdAt: serverTimestamp(),
      });

      batch.update(unitRef, {
        status: 'sold',
        soldAt: serverTimestamp(),
        saleId: saleRef.id,
        warrantyExpiry: unit.warrantyExpiry || '',
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      playDropcoinTone();
      setToast(`Sold ${product.name} (${unit.serialNumber}) for ${formatKES(priceAtSale)}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'sales');
    }
  };

  const handleReturnSale = async (sale: Sale) => {
    if (!user || sale.status === 'returned') return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'sales', sale.id), { status: 'returned' });

      const linkedItems = saleItemsBySale.get(sale.id) || [];
      for (const li of linkedItems) {
        batch.update(doc(db, 'units', li.unitId), {
          status: 'returned',
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
      setToast('Sale marked as returned and unit status updated.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `sales/${sale.id}`);
    }
  };

  const handleUpdateUnitStatus = async (unit: Unit, nextStatus: 'in_stock' | 'damaged' | 'returned') => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'units', unit.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      setToast(`Unit ${unit.serialNumber} marked as ${nextStatus.replace('_', ' ')}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `units/${unit.id}`);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newSupplierName.trim()) return;
    setSavingSupplier(true);
    try {
      await addDoc(collection(db, 'suppliers'), {
        ownerId: user.uid,
        name: newSupplierName.trim().slice(0, 100),
        contactName: newSupplierContact.trim().slice(0, 80),
        phone: newSupplierPhone.trim().slice(0, 40),
        email: '',
        leadTimeDays: Number(newSupplierLead) || 1,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewSupplierName('');
      setNewSupplierContact('');
      setNewSupplierPhone('');
      setNewSupplierLead(3);
      setToast('Supplier added.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'suppliers');
    } finally {
      setSavingSupplier(false);
    }
  };

  const handleLogRestockOrder = async (params: {
    supplierId?: string;
    supplierName: string;
    estimatedLeadDays: number;
    actualLeadDays: number;
    unitCount: number;
    orderedDate: string;
    receivedDate: string;
  }) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'restock_orders'), {
        ownerId: user.uid,
        supplierId: params.supplierId || '',
        supplierName: params.supplierName,
        estimatedLeadDays: params.estimatedLeadDays,
        actualLeadDays: params.actualLeadDays,
        unitCount: params.unitCount,
        orderedDate: params.orderedDate,
        receivedDate: params.receivedDate,
        createdAt: serverTimestamp(),
      });
      setToast(`Logged order from ${params.supplierName} (${params.actualLeadDays}d lead time).`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'restock_orders');
    }
  };

  const handleLoadSampleData = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const batch = writeBatch(db);

      for (const sup of SAMPLE_SUPPLIERS) {
        const supRef = doc(collection(db, 'suppliers'));
        batch.set(supRef, {
          ownerId: user.uid,
          name: sup.name,
          contactName: sup.contactName,
          phone: sup.phone,
          email: sup.email,
          leadTimeDays: sup.leadTimeDays,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      for (const sample of SAMPLE_PRODUCTS) {
        const prodRef = doc(collection(db, 'products'));
        batch.set(prodRef, {
          ownerId: user.uid,
          name: sample.name,
          brand: sample.brand,
          model: sample.model,
          sku: sample.sku,
          barcode: sample.barcode,
          category: sample.category,
          costPrice: sample.costPrice,
          sellPrice: sample.sellPrice,
          reorderThreshold: sample.reorderThreshold,
          supplierName: sample.supplierName,
          status: 'active',
          notes: sample.notes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        for (const serial of sample.serials) {
          const unitRef = doc(collection(db, 'units'));
          batch.set(unitRef, {
            ownerId: user.uid,
            productId: prodRef.id,
            serialNumber: serial,
            status: 'in_stock',
            costSnapshot: sample.costPrice,
            receivedAt: serverTimestamp(),
            soldAt: null,
            saleId: null,
            warrantyExpiry: '2027-11-18',
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
      setToast('Loaded sample Rebootly catalog, serialized units, and suppliers in KES.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'products');
    } finally {
      setSeeding(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500">Loading Rebootly workspace...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  const navItems: { id: NavView; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      id: 'inventory',
      label: 'Products (SKUs)',
      icon: <Boxes className="w-4 h-4 shrink-0" />,
      count: activeProducts.length,
    },
    {
      id: 'units',
      label: 'Serialized Units',
      icon: <Barcode className="w-4 h-4 shrink-0" />,
      count: units.length,
    },
    {
      id: 'restock',
      label: 'Restock Queue',
      icon: <AlertCircle className="w-4 h-4 shrink-0" />,
      count: metrics.restockCount,
    },
    {
      id: 'sales',
      label: 'Sales Log',
      icon: <Receipt className="w-4 h-4 shrink-0" />,
      count: sales.length,
    },
    {
      id: 'suppliers',
      label: 'Suppliers',
      icon: <Truck className="w-4 h-4 shrink-0" />,
      count: suppliers.length,
    },
  ];

  const viewTitle = navItems.find((n) => n.id === activeView)?.label || 'Inventory';

  return (
    <div className="min-h-screen islamic-pattern-bg text-slate-900 flex">
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white/85 backdrop-blur-xl border-r border-blue-200/75 shadow-sm shadow-blue-950/5 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-blue-100/90">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={REBOOTLY_LOGO_URL}
              alt="Sales Inventory"
              className="h-9 w-9 rounded-lg object-cover shadow-xs border border-blue-100 shrink-0"
            />
            <span className="font-[Georgia] font-bold text-[#04295f] text-base tracking-tight truncate">
              Sales Inventory
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="p-1 text-slate-400 hover:text-[#0a2540] lg:hidden"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1.5">
          {navItems.map((nav) => {
            const active = activeView === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => {
                  setActiveView(nav.id);
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${
                  active
                    ? 'bg-gradient-to-r from-[#0a2540] via-[#0e3a6e] to-[#1d4ed8] text-white shadow-sm shadow-blue-900/20'
                    : 'text-[#0a2540]/75 hover:bg-blue-50/90 hover:text-[#0a2540]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {nav.icon}
                  {nav.label}
                </span>
                {typeof nav.count === 'number' && (
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      active
                        ? 'text-orange-300 font-semibold'
                        : nav.id === 'restock' && nav.count > 0
                        ? 'text-orange-600 font-semibold'
                        : 'text-blue-900/45'
                    }`}
                  >
                    {nav.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blue-100/90 space-y-3 bg-gradient-to-b from-transparent to-blue-50/40">
          <PWAInstallButton />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#0a2540] truncate">
              {user.displayName || 'Store Manager'} · {userRole}
            </p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#0a2540]/75 hover:text-[#0a2540] hover:bg-blue-100/60 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-blue-200/75 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="p-1.5 text-[#0a2540] hover:bg-blue-50 rounded-lg lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline font-[Georgia] font-bold text-[#04295f] tracking-wide">
                Sales Inventory
              </span>
              <span className="text-orange-400 hidden sm:inline">/</span>
              <h1 className="font-serif font-bold text-[#0a2540] truncate">{viewTitle}</h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setItemModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl hover:from-orange-600 hover:to-orange-700 shadow-sm shadow-orange-500/25 transition-all whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Product SKU
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* 5-Column Vibrant Orange, Blue & Navy Frosted Glasscard Grid */}
          <section
            aria-label="Store summary"
            className="grid grid-cols-2 lg:grid-cols-5 gap-3.5"
          >
            {/* 1. In-Stock Units — Light Vibrant Blue Glass */}
            <div className="bg-gradient-to-br from-blue-100/85 via-sky-50/80 to-white/75 backdrop-blur-xl border border-blue-200/90 rounded-2xl p-3.5 sm:p-4 shadow-sm shadow-blue-900/5 hover:shadow-md hover:shadow-blue-900/10 hover:-translate-y-0.5 transition-all">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold tracking-wide text-[#0e3a6e] truncate">
                  In-Stock Units (Derived)
                </p>
                <span className="w-6 h-6 rounded-lg bg-blue-600/15 text-blue-700 flex items-center justify-center shrink-0">
                  <Boxes className="w-3.5 h-3.5" />
                </span>
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-semibold font-mono tabular-nums tracking-tight text-[#0a2540]">
                {metrics.totalInStockUnits}
              </p>
              <p className="mt-0.5 text-[11px] text-blue-900/70 truncate">
                Across {activeProducts.length} active SKU{activeProducts.length === 1 ? '' : 's'}
              </p>
            </div>

            {/* 2. Inventory Retail Value — Light Vibrant Orange Glass */}
            <div className="bg-gradient-to-br from-orange-100/85 via-amber-50/80 to-white/75 backdrop-blur-xl border border-orange-200/90 rounded-2xl p-3.5 sm:p-4 shadow-sm shadow-orange-900/5 hover:shadow-md hover:shadow-orange-900/10 hover:-translate-y-0.5 transition-all">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold tracking-wide text-orange-900 truncate">
                  Inventory Retail Value
                </p>
                <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-700 flex items-center justify-center shrink-0">
                  <Receipt className="w-3.5 h-3.5" />
                </span>
              </div>
              <p className="mt-2 text-lg sm:text-2xl font-semibold font-mono tabular-nums tracking-tight text-[#0a2540] truncate">
                {formatKES(metrics.inventoryValue)}
              </p>
              <p className="mt-0.5 text-[11px] text-orange-900/75 truncate">Active in-stock units</p>
            </div>

            {/* 3. Needs Restock — Vibrant Orange-Coral or Light Navy-Blue Glass */}
            <div
              className={`backdrop-blur-xl rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all border ${
                metrics.restockCount > 0
                  ? 'bg-gradient-to-br from-orange-100/90 via-rose-50/75 to-white/75 border-orange-300/85 shadow-orange-900/5'
                  : 'bg-gradient-to-br from-sky-100/80 via-blue-50/75 to-white/75 border-sky-200/90 shadow-blue-900/5'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p
                  className={`text-[11px] font-semibold tracking-wide truncate ${
                    metrics.restockCount > 0 ? 'text-orange-950' : 'text-[#0e3a6e]'
                  }`}
                >
                  Needs Restock
                </p>
                <span
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                    metrics.restockCount > 0
                      ? 'bg-orange-500/20 text-orange-700'
                      : 'bg-blue-600/15 text-blue-700'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                </span>
              </div>
              <p
                className={`mt-2 text-xl sm:text-2xl font-semibold font-mono tabular-nums tracking-tight ${
                  metrics.restockCount > 0 ? 'text-orange-700' : 'text-[#0a2540]'
                }`}
              >
                {metrics.restockCount}
              </p>
              <p
                className={`mt-0.5 text-[11px] truncate ${
                  metrics.restockCount > 0 ? 'text-orange-900/75' : 'text-blue-900/70'
                }`}
              >
                {metrics.outOfStockCount > 0
                  ? `${metrics.outOfStockCount} out of stock`
                  : 'All SKUs above zero'}
              </p>
            </div>

            {/* 4. Sales Revenue — Light Navy Blue Glass */}
            <div className="bg-gradient-to-br from-[#dbeafe]/85 via-[#e0e7ff]/75 to-white/80 backdrop-blur-xl border border-blue-300/80 rounded-2xl p-3.5 sm:p-4 shadow-sm shadow-blue-950/10 hover:shadow-md hover:shadow-blue-950/15 hover:-translate-y-0.5 transition-all">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold tracking-wide text-[#0a2540] truncate">
                  Sales Revenue
                </p>
                <span
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                    metrics.totalProfit < 0
                      ? 'bg-red-500/15 text-red-700'
                      : 'bg-[#0a2540]/12 text-[#0a2540]'
                  }`}
                >
                  {metrics.totalProfit < 0 ? (
                    <TrendingDown className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingUp className="w-3.5 h-3.5" />
                  )}
                </span>
              </div>
              <p className="mt-2 text-lg sm:text-2xl font-semibold font-mono tabular-nums tracking-tight text-[#0a2540] truncate">
                {formatKES(metrics.totalRevenue)}
              </p>
              <p
                className={`mt-0.5 text-[11px] font-mono tabular-nums inline-flex items-center gap-1 font-semibold truncate ${
                  metrics.totalProfit > 0
                    ? 'text-emerald-700'
                    : metrics.totalProfit < 0
                    ? 'text-red-600'
                    : 'text-[#0a2540]/70'
                }`}
              >
                {metrics.totalProfit > 0 ? (
                  <>
                    <TrendingUp className="w-3 h-3 shrink-0" />
                    Profit +{formatKES(metrics.totalProfit)}
                  </>
                ) : metrics.totalProfit < 0 ? (
                  <>
                    <TrendingDown className="w-3 h-3 shrink-0" />
                    Loss {formatKES(metrics.totalProfit)}
                  </>
                ) : (
                  `${metrics.totalSoldUnits} sold · Break-even`
                )}
              </p>
            </div>

            {/* 5. Daily Revenue Goal — Light Blue + Orange Blend Glass */}
            <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-sky-100/85 via-white/80 to-orange-100/80 backdrop-blur-xl border border-blue-200/90 rounded-2xl p-3.5 sm:p-4 shadow-sm shadow-blue-900/5 hover:shadow-md hover:shadow-blue-900/10 hover:-translate-y-0.5 transition-all">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold tracking-wide text-[#0a2540] truncate">
                  Daily Revenue Goal
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setGoalInput(String(dailyGoal));
                    setEditingGoal((prev) => !prev);
                  }}
                  className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-700 hover:bg-orange-500/30 flex items-center justify-center shrink-0 transition-colors"
                  title="Set daily revenue goal"
                  aria-label="Set daily revenue goal"
                >
                  <Target className="w-3.5 h-3.5" />
                </button>
              </div>

              {editingGoal ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const next = Math.max(1, Number(goalInput) || dailyGoal);
                    setDailyGoal(next);
                    localStorage.setItem('rebootly_daily_revenue_goal', String(next));
                    setEditingGoal(false);
                    setToast(`Daily revenue goal updated to ${formatKES(next)}.`);
                  }}
                  className="mt-2 flex items-center gap-1.5"
                >
                  <input
                    type="number"
                    min={1}
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    className="w-full px-2 py-1 text-xs font-mono bg-white border border-blue-300 rounded-md focus:outline-none focus:border-blue-600"
                    aria-label="Daily goal in KES"
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 text-[11px] font-semibold text-white bg-[#0a2540] rounded-md hover:bg-[#0e3a6e] shrink-0"
                  >
                    Save
                  </button>
                </form>
              ) : (
                <>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <p className="text-lg sm:text-xl font-semibold font-mono tabular-nums tracking-tight text-[#0a2540] truncate">
                      {Math.min(100, Math.round((metrics.todayRevenue / dailyGoal) * 100))}%
                    </p>
                    <span className="text-[11px] font-mono tabular-nums text-[#0a2540]/70 truncate">
                      {formatKES(dailyGoal)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full bg-blue-200/70 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        metrics.todayRevenue >= dailyGoal
                          ? 'bg-emerald-600'
                          : 'bg-gradient-to-r from-[#0e3a6e] via-blue-600 to-orange-500'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.round((metrics.todayRevenue / dailyGoal) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-mono tabular-nums text-[#0a2540]/70 truncate">
                      Today: {formatKES(metrics.todayRevenue)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setGoalModalOpen(true)}
                      className="text-[11px] font-semibold text-blue-700 hover:text-orange-600 hover:underline whitespace-nowrap shrink-0 transition-colors"
                    >
                      7d trend →
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* 1. PRODUCTS (SKUs) VIEW */}
          {activeView === 'inventory' && (
            <section className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search product, SKU, barcode, brand..."
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                    />
                  </div>

                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    aria-label="Filter by category"
                    className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                  >
                    <option value="All">All Categories</option>
                    {ELECTRONICS_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start md:self-auto overflow-x-auto max-w-full">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'in-stock', label: 'In Stock' },
                      { id: 'low-stock', label: 'Low Stock' },
                      { id: 'out-of-stock', label: 'Out of Stock' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        statusFilter === tab.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white/85 backdrop-blur-md border border-blue-200/75 rounded-2xl shadow-sm shadow-blue-950/5 overflow-hidden">
                {loadingData ? (
                  <div className="p-8 space-y-3">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="h-10 bg-slate-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : activeProducts.length === 0 ? (
                  <div className="p-12 text-center space-y-4">
                    <Boxes className="w-8 h-8 text-slate-300 mx-auto" />
                    <div className="space-y-1">
                      <h2 className="text-base font-semibold text-slate-900">
                        Your Rebootly catalog is empty
                      </h2>
                      <p className="text-sm text-slate-500 max-w-md mx-auto">
                        Add your first electronics SKU or load sample Kenyan electronics stock with
                        serialized IMEI/Serial units.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProduct(null);
                          setItemModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add First SKU
                      </button>
                      <button
                        type="button"
                        onClick={handleLoadSampleData}
                        disabled={seeding}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      >
                        <PackagePlus className="w-4 h-4" />
                        {seeding ? 'Loading...' : 'Load Sample Electronics (KES)'}
                      </button>
                    </div>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">
                    No products match your current search or filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                          <th className="py-3 px-4">Product</th>
                          <th className="py-3 px-4">SKU / Barcode</th>
                          <th className="py-3 px-4 text-right">In Stock</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Sell Price</th>
                          <th className="py-3 px-4 text-right">Sold</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredProducts.map((product) => {
                          const unitInfo = unitsByProduct.get(product.id) || {
                            inStock: [],
                            soldCount: 0,
                          };
                          const stock = unitInfo.inStock.length;
                          const status = getStockStatus(stock, product.reorderThreshold);

                          return (
                            <tr
                              key={product.id}
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="py-3 px-4 min-w-[220px]">
                                <div className="font-medium text-slate-900">{product.name}</div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {product.brand}
                                  {product.model ? ` ${product.model}` : ''} · {product.category}
                                  {product.supplierName ? ` · ${product.supplierName}` : ''}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                                <div>{product.sku}</div>
                                {product.barcode && (
                                  <div className="text-slate-400">{product.barcode}</div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                                <span
                                  className={`font-semibold ${
                                    status === 'out-of-stock'
                                      ? 'text-red-600'
                                      : status === 'low-stock'
                                      ? 'text-orange-600'
                                      : 'text-slate-900'
                                  }`}
                                >
                                  {stock}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {' '}
                                  / {product.reorderThreshold} min
                                </span>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                {status === 'in-stock' && (
                                  <span className="text-xs font-medium text-emerald-700">
                                    In Stock
                                  </span>
                                )}
                                {status === 'low-stock' && (
                                  <span className="text-xs font-medium text-orange-700">
                                    Low Stock
                                  </span>
                                )}
                                {status === 'out-of-stock' && (
                                  <span className="text-xs font-medium text-red-700">
                                    Out of Stock
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                                <div className="text-slate-900 font-medium">
                                  {formatKES(product.sellPrice)}
                                </div>
                                <div className="text-xs text-slate-400">
                                  Cost {formatKES(product.costPrice)}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                                {unitInfo.soldCount}
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  {stock > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => setSellProduct(product)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      Mark Sold
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setRestockProduct(product)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-orange-800 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                                    >
                                      <PackagePlus className="w-3.5 h-3.5" />
                                      Receive
                                    </button>
                                  )}

                                  {stock > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setRestockProduct(product)}
                                      className="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                      title="Receive serialized units"
                                      aria-label={`Receive units for ${product.name}`}
                                    >
                                      <PackagePlus className="w-4 h-4" />
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingProduct(product);
                                      setItemModalOpen(true);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Edit SKU"
                                    aria-label={`Edit ${product.name}`}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleArchiveProduct(product)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Archive SKU (never delete)"
                                    aria-label={`Archive ${product.name}`}
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 2. SERIALIZED UNITS VIEW */}
          {activeView === 'units' && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-blue-900/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={unitSearch}
                    onChange={(e) => setUnitSearch(e.target.value)}
                    placeholder="Search Serial / IMEI, product..."
                    className="w-full pl-9 pr-8 py-2 text-sm bg-white/90 backdrop-blur-md border border-blue-200/85 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/25 focus:border-orange-500"
                  />
                  {unitSearch && (
                    <button
                      type="button"
                      onClick={() => setUnitSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0a2540]"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 p-1 bg-blue-100/70 backdrop-blur-sm border border-blue-200/60 rounded-xl self-start sm:self-auto">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'in_stock', label: 'In Stock' },
                      { id: 'sold', label: 'Sold' },
                      { id: 'returned', label: 'Returned' },
                      { id: 'damaged', label: 'Damaged' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setUnitStatusFilter(tab.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                        unitStatusFilter === tab.id
                          ? 'bg-white text-[#0a2540] shadow-xs'
                          : 'text-[#0a2540]/70 hover:text-[#0a2540]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white/85 backdrop-blur-md border border-blue-200/75 rounded-2xl shadow-sm shadow-blue-950/5 overflow-hidden">
                {filteredUnits.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">
                    No serialized units found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                          <th className="py-3 px-4">Serial / IMEI</th>
                          <th className="py-3 px-4">Product</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Cost Snapshot</th>
                          <th className="py-3 px-4">Warranty Expiry</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredUnits.map((unit) => {
                          const prod = productById.get(unit.productId);
                          return (
                            <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                                {unit.serialNumber}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-900">
                                  {prod?.name || 'Unknown SKU'}
                                </div>
                                <div className="text-xs text-slate-500 font-mono">
                                  {prod?.sku || unit.productId}
                                </div>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap text-xs font-medium">
                                {unit.status === 'in_stock' && (
                                  <span className="text-emerald-700">In Stock</span>
                                )}
                                {unit.status === 'sold' && (
                                  <span className="text-slate-600">Sold</span>
                                )}
                                {unit.status === 'returned' && (
                                  <span className="text-amber-700">Returned</span>
                                )}
                                {unit.status === 'damaged' && (
                                  <span className="text-red-700">Damaged</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                                {formatKES(unit.costSnapshot)}
                              </td>
                              <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                                {unit.warrantyExpiry || '—'}
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                {unit.status === 'in_stock' && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateUnitStatus(unit, 'damaged')}
                                    className="text-xs font-medium text-slate-500 hover:text-red-600"
                                  >
                                    Mark Damaged
                                  </button>
                                )}
                                {(unit.status === 'returned' || unit.status === 'damaged') && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateUnitStatus(unit, 'in_stock')}
                                    className="text-xs font-medium text-emerald-700 hover:underline"
                                  >
                                    Return to Stock
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 3. RESTOCK QUEUE VIEW */}
          {activeView === 'restock' && (
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Items Needing Restock</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Derived in-stock count at or below threshold, ordered by urgency.
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {restockQueue.length} SKU{restockQueue.length === 1 ? '' : 's'}
                </span>
              </div>

              {restockQueue.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <h3 className="text-sm font-semibold text-slate-900">All stocked up</h3>
                  <p className="text-xs text-slate-500">
                    Every active SKU has more in-stock units than its restock threshold.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                        <th className="py-3 px-4">Product</th>
                        <th className="py-3 px-4">Supplier</th>
                        <th className="py-3 px-4 text-right">In Stock</th>
                        <th className="py-3 px-4 text-right">Threshold</th>
                        <th className="py-3 px-4 text-right">Unit Cost</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {restockQueue.map(({ product, stock }) => (
                        <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900">{product.name}</div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                              {product.sku} · {product.brand}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-xs">
                            {product.supplierName || '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                            <span className={stock === 0 ? 'text-red-600' : 'text-orange-600'}>
                              {stock}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                            {product.reorderThreshold}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                            {formatKES(product.costPrice)}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setRestockProduct(product)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors"
                            >
                              <PackagePlus className="w-3.5 h-3.5" />
                              Receive Stock
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* 4. SALES LOG VIEW (30-DAY BAR + 12-MONTH LINE CHARTS, PROFIT/LOSS & CSV EXPORT) */}
          {activeView === 'sales' && (
            <section className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SalesRevenueChart sales={sales} />
                <MonthlyRevenueChart sales={sales} />
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={salesSearch}
                      onChange={(e) => setSalesSearch(e.target.value)}
                      placeholder="Search product, Serial/IMEI, customer..."
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                    />
                  </div>

                  <select
                    value={salesChannelFilter}
                    onChange={(e) =>
                      setSalesChannelFilter(e.target.value as 'all' | SaleChannel)
                    }
                    aria-label="Filter by channel"
                    className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                  >
                    <option value="all">All Channels</option>
                    {(Object.keys(CHANNEL_LABELS) as SaleChannel[]).map((ch) => (
                      <option key={ch} value={ch}>
                        {CHANNEL_LABELS[ch]}
                      </option>
                    ))}
                  </select>

                  <select
                    value={salesPaymentFilter}
                    onChange={(e) =>
                      setSalesPaymentFilter(e.target.value as 'all' | PaymentMethod)
                    }
                    aria-label="Filter by payment method"
                    className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                  >
                    <option value="all">All Payments</option>
                    {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((pm) => (
                      <option key={pm} value={pm}>
                        {PAYMENT_LABELS[pm]}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleExportSalesCsv}
                  disabled={filteredSales.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 self-start md:self-auto"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export to CSV
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {filteredSales.length === 0 ? (
                  <div className="p-12 text-center space-y-2">
                    <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
                    <h3 className="text-sm font-semibold text-slate-900">No sales found</h3>
                    <p className="text-xs text-slate-500">
                      Mark a serialized unit as sold from the Products view to record a sale.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                          <th className="py-3 px-4">Date &amp; Time</th>
                          <th className="py-3 px-4">Item &amp; Serial/IMEI</th>
                          <th className="py-3 px-4">Channel · Payment</th>
                          <th className="py-3 px-4">Customer</th>
                          <th className="py-3 px-4 text-right">Total (KES)</th>
                          <th className="py-3 px-4 text-right">Profit / Loss</th>
                          <th className="py-3 px-4 text-right">Status / Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredSales.map((sale) => {
                          const dateStr = sale.soldAt?.toDate
                            ? sale.soldAt.toDate().toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Just now';
                          const lineItems = saleItemsBySale.get(sale.id) || [];

                          return (
                            <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                                {dateStr}
                              </td>
                              <td className="py-3 px-4">
                                {lineItems.map((li) => (
                                  <div key={li.id}>
                                    <div className="font-medium text-slate-900">
                                      {li.productName}
                                    </div>
                                    <div className="text-xs text-slate-500 font-mono">
                                      {li.sku} · {li.serialNumber}
                                    </div>
                                  </div>
                                ))}
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                                {CHANNEL_LABELS[sale.channel]} ·{' '}
                                {PAYMENT_LABELS[sale.paymentMethod]}
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                                <div>{sale.customerName || 'Walk-in'}</div>
                                {sale.customerPhone && (
                                  <div className="font-mono text-slate-400">
                                    {sale.customerPhone}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                                {formatKES(sale.totalAmount)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                                {sale.totalProfit > 0 ? (
                                  <span className="inline-flex items-center justify-end gap-1 text-xs font-semibold text-emerald-700">
                                    <TrendingUp className="w-3.5 h-3.5" />
                                    Profit +{formatKES(sale.totalProfit)}
                                  </span>
                                ) : sale.totalProfit < 0 ? (
                                  <span className="inline-flex items-center justify-end gap-1 text-xs font-semibold text-red-600">
                                    <TrendingDown className="w-3.5 h-3.5" />
                                    Loss {formatKES(sale.totalProfit)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-500">Break-even</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                {sale.status === 'returned' ? (
                                  <span className="text-xs font-medium text-amber-700">
                                    Returned
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleReturnSale(sale)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Mark sale returned (audit-safe)"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Return
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 5. SUPPLIERS VIEW */}
          {activeView === 'suppliers' && (
            <section className="space-y-6">
              <SupplierPerformance
                suppliers={suppliers}
                restockOrders={restockOrders}
                onLogOrder={handleLogRestockOrder}
              />

              <form
                onSubmit={handleAddSupplier}
                className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
              >
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    placeholder="e.g. Nairobi Digital Wholesale"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    placeholder="Name"
                    value={newSupplierContact}
                    onChange={(e) => setNewSupplierContact(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    maxLength={40}
                    placeholder="+254 7..."
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="w-20">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Lead (d)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={newSupplierLead}
                      onChange={(e) => setNewSupplierLead(Number(e.target.value))}
                      className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingSupplier}
                    className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {savingSupplier ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </form>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {suppliers.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">
                    No suppliers added yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                          <th className="py-3 px-4">Supplier</th>
                          <th className="py-3 px-4">Contact</th>
                          <th className="py-3 px-4">Phone</th>
                          <th className="py-3 px-4 text-right">Lead Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {suppliers.map((sup) => (
                          <tr key={sup.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-medium text-slate-900">{sup.name}</td>
                            <td className="py-3 px-4 text-slate-600">{sup.contactName || '—'}</td>
                            <td className="py-3 px-4 font-mono text-xs text-slate-600">
                              {sup.phone || '—'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                              {sup.leadTimeDays} day{sup.leadTimeDays === 1 ? '' : 's'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>

        <footer className="py-4 px-6 border-t border-blue-200/60 bg-white/55 backdrop-blur-md text-center text-xs text-[#0a2540]/75">
          Made with ❤️ by{' '}
          <a
            href="https://edwin-angatia.github.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#04295f] hover:text-orange-600 underline underline-offset-2 transition-colors"
          >
            Rebootly
          </a>
        </footer>
      </div>

      {/* Modals */}
      <ItemModal
        isOpen={itemModalOpen}
        editingProduct={editingProduct}
        suppliers={suppliers}
        onClose={() => {
          setItemModalOpen(false);
          setEditingProduct(null);
        }}
        onSave={handleSaveProduct}
      />

      <RestockModal
        product={restockProduct}
        currentStock={restockProduct ? unitsByProduct.get(restockProduct.id)?.inStock.length ?? 0 : 0}
        onClose={() => setRestockProduct(null)}
        onReceiveUnits={handleReceiveUnits}
      />

      <SellUnitModal
        product={sellProduct}
        availableUnits={sellProduct ? unitsByProduct.get(sellProduct.id)?.inStock ?? [] : []}
        onClose={() => setSellProduct(null)}
        onConfirmSale={handleConfirmSale}
      />

      <GoalAttainmentModal
        isOpen={goalModalOpen}
        sales={sales}
        dailyGoal={dailyGoal}
        onClose={() => setGoalModalOpen(false)}
      />

      {!isOnline && (
        <div className="fixed bottom-5 left-5 z-50 bg-amber-600 text-white px-3.5 py-2 rounded-lg shadow-lg text-xs font-medium">
          Offline Mode — Changes will sync when reconnected.
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm">
          <span>{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
