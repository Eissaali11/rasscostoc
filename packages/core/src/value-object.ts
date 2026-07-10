export abstract class ValueObject<Props extends Record<string, any>> {
  public readonly props: Props;

  constructor(props: Props) {
    this.props = Object.freeze(props);
  }

  public equals(vo?: ValueObject<Props>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }
    if (vo.props === undefined) {
      return false;
    }
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }
}
