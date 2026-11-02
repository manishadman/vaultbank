ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_amount_positive" CHECK ("amountMinor" > 0);

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_amount_nonnegative" CHECK ("amountMinor" >= 0);

CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries are immutable';
END;
$$;

CREATE TRIGGER ledger_no_mutation
BEFORE UPDATE OR DELETE ON "LedgerEntry"
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

CREATE OR REPLACE FUNCTION prevent_completed_transaction_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'COMPLETED' AND (
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW."amountMinor" IS DISTINCT FROM OLD."amountMinor" OR
    NEW.type IS DISTINCT FROM OLD.type OR
    NEW."referenceNumber" IS DISTINCT FROM OLD."referenceNumber"
  ) THEN
    RAISE EXCEPTION 'Completed transactions are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER completed_transaction_no_change
BEFORE UPDATE ON "Transaction"
FOR EACH ROW EXECUTE FUNCTION prevent_completed_transaction_change();
