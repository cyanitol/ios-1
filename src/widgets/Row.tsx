import * as React from 'react';
import { StyleSheet, ViewProps, View } from 'react-native';

class Row extends React.Component<ViewProps> {
  public render() {
    const { children, style } = this.props;

    return (
      <View style={[styles.row, style]}>
        {children}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
});

export default Row;
