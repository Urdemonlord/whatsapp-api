import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Unique,
  ForeignKey,
  BelongsTo,
  HasMany,
  Default,
  Index,
} from 'sequelize-typescript';
import { User } from './User';
import { AuthKey } from './AuthKey';

/**
 * Session Status Enum
 */
export enum SessionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  QR_READY = 'qr_ready',
  LOGGED_OUT = 'logged_out',
}

/**
 * Session Model
 * Represents a WhatsApp session that belongs to a user
 */
@Table({
  tableName: 'sessions',
  timestamps: true,
})
export class Session extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Unique
  @Index
  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    comment: 'Unique session identifier for WhatsApp connection',
  })
  declare session_id: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare user_id: string;

  @Default(SessionStatus.DISCONNECTED)
  @Column({
    type: DataType.ENUM(...Object.values(SessionStatus)),
    allowNull: false,
  })
  declare status: SessionStatus;

  @Column({
    type: DataType.STRING(500),
    allowNull: true,
    comment: 'Webhook URL for receiving message events',
  })
  declare webhook_url: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: true,
    comment: 'WhatsApp phone number when connected',
  })
  declare phone_number: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: true,
    comment: 'WhatsApp display name',
  })
  declare name: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare last_connected: Date;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
    comment: 'Number of reconnection attempts',
  })
  declare reconnect_attempts: number;

  // Relationship: Session belongs to User
  @BelongsTo(() => User)
  declare user: User;

  // Relationship: Session has many AuthKeys
  @HasMany(() => AuthKey)
  declare auth_keys: AuthKey[];

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this.status === SessionStatus.CONNECTED;
  }

  /**
   * Update session status
   */
  async updateStatus(status: SessionStatus): Promise<void> {
    this.status = status;
    if (status === SessionStatus.CONNECTED) {
      this.last_connected = new Date();
      this.reconnect_attempts = 0;
    }
    await this.save();
  }

  /**
   * Increment reconnect attempts
   */
  async incrementReconnectAttempts(): Promise<number> {
    this.reconnect_attempts += 1;
    await this.save();
    return this.reconnect_attempts;
  }
}

export default Session;
