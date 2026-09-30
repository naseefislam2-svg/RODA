"""Public receipts and hashed guidance metadata only."""

import sqlalchemy as sa
from alembic import op

revision = "001_public_metadata"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("public_receipts",
                    sa.Column("id", sa.Integer, primary_key=True),
                    sa.Column("network", sa.String(12), nullable=False),
                    sa.Column("room_id", sa.String(64), nullable=False),
                    sa.Column("contract_address", sa.String(64), nullable=False),
                    sa.Column("tx_hash", sa.String(64), nullable=False),
                    sa.Column("action", sa.String(12), nullable=False),
                    sa.Column("block_height", sa.BigInteger, nullable=False),
                    sa.Column("verification", sa.String(24), nullable=False),
                    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
                    sa.UniqueConstraint("network", "tx_hash"))
    op.create_index("ix_public_receipts_contract_address", "public_receipts", ["contract_address"])
    op.create_table("guidance_audit",
                    sa.Column("id", sa.Integer, primary_key=True),
                    sa.Column("request_hash", sa.String(64), nullable=False),
                    sa.Column("source", sa.String(20), nullable=False),
                    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))


def downgrade():
    op.drop_table("guidance_audit")
    op.drop_index("ix_public_receipts_contract_address", "public_receipts")
    op.drop_table("public_receipts")
