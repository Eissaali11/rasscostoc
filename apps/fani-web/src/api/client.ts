export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  employeeCode?: string;
  avatarUrl?: string;
}

export interface TransferItem {
  id: string;
  itemTypeId: string;
  itemTypeName: string;
  category: 'devices' | 'sim';
  requestedQuantity: number;
  scannedQuantity: number;
  scannedSerials: string[];
}

export interface WarehouseTransfer {
  id: string;
  transferNumber: string;
  sourceWarehouseName: string;
  targetWarehouseName: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'PARTIAL';
  createdAt: string;
  items: TransferItem[];
}

class ApiClient {
  private baseUrl = '/api';

  private getHeaders(): Record<string, string> {
    const token = localStorage.getItem('fani_auth_token');
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async login(username: String, password: String): Promise<{ success: boolean; user?: User; message?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.token) {
          localStorage.setItem('fani_auth_token', data.token);
        }
        localStorage.setItem('fani_user', JSON.stringify(data.user || data.data));
        return { success: true, user: data.user || data.data };
      }
      return { success: false, message: data.message || 'فشل تسجيل الدخول' };
    } catch (err: any) {
      return { success: false, message: err.message || 'تعذر الاتصال بالخادم' };
    }
  }

  async getMe(): Promise<User | null> {
    try {
      const res = await fetch(`${this.baseUrl}/auth/me`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.user || data;
    } catch {
      return null;
    }
  }

  logout() {
    localStorage.removeItem('fani_auth_token');
    localStorage.removeItem('fani_user');
  }

  async getTransfers(): Promise<WarehouseTransfer[]> {
    try {
      const res = await fetch(`${this.baseUrl}/warehouse-transfers`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.transfers || []);
    } catch {
      return [];
    }
  }

  async getTransferDetails(id: string): Promise<WarehouseTransfer | null> {
    try {
      const res = await fetch(`${this.baseUrl}/warehouse-transfers/${id}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.transfer || data;
    } catch {
      return null;
    }
  }

  async acceptTransfer(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/warehouse-transfers/${id}/accept`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, message: data.message || 'تم تأكيد الاستلام بنجاح' };
      }
      return { success: false, message: data.message || 'فشل تأكيد الاستلام' };
    } catch (err: any) {
      return { success: false, message: err.message || 'خطأ أثناء الاتصال' };
    }
  }

  async scanItem(serialNumber: string, transferId?: string, itemTypeId?: string): Promise<{ success: boolean; message?: string; item?: any }> {
    try {
      const res = await fetch(`${this.baseUrl}/serialized-items/scan-in`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ serialNumber, transferId, itemTypeId }),
      });
      const data = await res.json();
      if (res.ok && (data.success !== false)) {
        return { success: true, message: 'تم المسح والمطابقة بنجاح', item: data };
      }
      return { success: false, message: data.message || 'السيريال غير مطابق أو مكرر' };
    } catch (err: any) {
      return { success: false, message: err.message || 'خطأ في المسح' };
    }
  }
}

export const api = new ApiClient();
