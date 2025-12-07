import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  Unique,
  HasMany,
  BeforeCreate,
  BeforeUpdate,
} from 'sequelize-typescript';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Session } from './Session';

/**
 * User Model
 * Represents a user who can have multiple WhatsApp sessions
 */
@Table({
  tableName: 'users',
  timestamps: true,
})
export class User extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Unique
  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  declare username: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare password: string;

  @Unique
  @Column({
    type: DataType.STRING(64),
    allowNull: false,
  })
  declare api_key: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  declare is_active: boolean;

  @Column(DataType.DATE)
  declare last_login: Date;

  // Relationship: User has many Sessions
  @HasMany(() => Session)
  declare sessions: Session[];

  /**
   * Hook: Generate UUID and API key before creating user
   */
  @BeforeCreate
  static async generateDefaults(user: User): Promise<void> {
    if (!user.id) {
      user.id = uuidv4();
    }
    if (!user.api_key) {
      user.api_key = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
    }
    if (user.password) {
      user.password = await bcrypt.hash(user.password, 12);
    }
  }

  /**
   * Hook: Hash password if changed
   */
  @BeforeUpdate
  static async hashPasswordOnUpdate(user: User): Promise<void> {
    if (user.changed('password')) {
      user.password = await bcrypt.hash(user.password, 12);
    }
  }

  /**
   * Verify password
   */
  async verifyPassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  /**
   * Regenerate API key
   */
  async regenerateApiKey(): Promise<string> {
    this.api_key = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
    await this.save();
    return this.api_key;
  }

  /**
   * Hide password in JSON output
   */
  toJSON(): object {
    const values = { ...this.get() };
    delete (values as Record<string, unknown>).password;
    return values;
  }
}

export default User;
