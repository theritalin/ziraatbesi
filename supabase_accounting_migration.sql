-- =============================================
-- MUHASEBE SİSTEMİ - Migration
-- =============================================

-- 1. ORTAKLAR TABLOSU
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners farm access" ON partners;
CREATE POLICY "Partners farm access" ON partners
  FOR ALL USING (farm_id IN (
    SELECT farm_id FROM users WHERE id = auth.uid()
    UNION
    SELECT farm_id FROM farm_users WHERE user_id = auth.uid()
  ));

-- 2. MUHASEBE İŞLEMLERİ TABLOSU
CREATE TABLE IF NOT EXISTS accounting_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'partner_withdrawal', 'partner_deposit', 'reimbursement')),
  category TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'credit_card', 'installment', 'personal_account')),
  payment_source TEXT CHECK (payment_source IN ('company', 'personal')),
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  installment_count INT,
  installment_start_date DATE,
  is_settled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Varolan kısıtlamayı güncelle (Eğer tablo önceden oluşturulmuşsa CREATE TABLE IF NOT EXISTS kısıtlamaları güncellemez)
ALTER TABLE accounting_transactions DROP CONSTRAINT IF EXISTS accounting_transactions_type_check;
ALTER TABLE accounting_transactions ADD CONSTRAINT accounting_transactions_type_check CHECK (type IN ('income', 'expense', 'partner_withdrawal', 'partner_deposit', 'reimbursement'));

-- RLS
ALTER TABLE accounting_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Accounting farm access" ON accounting_transactions;
CREATE POLICY "Accounting farm access" ON accounting_transactions
  FOR ALL USING (farm_id IN (
    SELECT farm_id FROM users WHERE id = auth.uid()
    UNION
    SELECT farm_id FROM farm_users WHERE user_id = auth.uid()
  ));

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_accounting_farm_date ON accounting_transactions(farm_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_accounting_partner ON accounting_transactions(partner_id);
CREATE INDEX IF NOT EXISTS idx_partners_farm ON partners(farm_id);
