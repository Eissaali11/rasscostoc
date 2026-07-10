export abstract class Entity<Props> {
  protected readonly _id: string;
  public readonly props: Props;

  constructor(props: Props, id?: string) {
    this._id = id || Math.random().toString(36).substring(2, 15);
    this.props = props;
  }

  get id(): string {
    return this._id;
  }

  public equals(object?: Entity<Props>): boolean {
    if (object == null || object == undefined) {
      return false;
    }

    if (this === object) {
      return true;
    }

    if (!(object instanceof Entity)) {
      return false;
    }

    return this._id === object._id;
  }
}
