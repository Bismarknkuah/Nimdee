-- Lets a canteen meal-plan subscription be paid as a single lump-sum wallet debit (an alternative to
-- billing it through Fees), distinct from a per-item PURCHASE so parents can tell the two apart.
ALTER TYPE "WalletTxType" ADD VALUE 'SUBSCRIPTION';
