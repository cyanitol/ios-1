import * as React from 'react';
import { useSelector } from 'react-redux';
import { useNavigation } from './navigation/Hooks';
import { Image, Linking, View } from 'react-native';
import { Subheading, Divider, List, Text, Paragraph } from 'react-native-paper';
import { SafeAreaView } from 'react-navigation';

import { useDispatch } from 'react-redux';
import { persistor, StoreState } from './store';
import { logout } from './store/actions';

import { unregisterSyncTask, SyncManager } from './sync/SyncManager';

import ScrollView from './widgets/ScrollView';
import ConfirmationDialog from './widgets/ConfirmationDialog';
import PrettyFingerprint from './widgets/PrettyFingerprint';

import { useCredentials } from './login';
import Container from './widgets/Container';

import * as C from './constants';

const menuItems = [
  {
    title: 'Settings',
    path: 'Settings',
    icon: 'settings',
  },
];

const externalMenuItems = [
  {
    title: 'FAQ',
    link: C.faq,
    icon: 'forum',
  },
  {
    title: 'Report issue',
    link: C.reportIssue,
    icon: 'bug',
  },
  {
    title: 'Contact developer',
    link: `mailto:${C.contactEmail}`,
    icon: 'email',
  },
];

if (!C.genericMode) {
  externalMenuItems.unshift(
    {
      title: 'Web site',
      link: C.homePage,
      icon: 'home',
    }
  );
}

function FingerprintDialog(props: { visible: boolean, onDismiss: () => void }) {
  const userInfo = useSelector((state: StoreState) => state.cache.userInfo);

  if (!userInfo) {
    return null;
  }

  const publicKey = userInfo.publicKey;

  return (
    <ConfirmationDialog
      title="Security Fingerprint"
      visible={props.visible}
      onOk={props.onDismiss}
      onCancel={props.onDismiss}
    >
      <>
        <Paragraph>
          Your security fingerprint is:
        </Paragraph>
        {publicKey &&
          <View style={{ justifyContent: 'center', alignItems: 'center', marginTop: 15 }}>
            <PrettyFingerprint publicKey={publicKey} />
          </View>
        }
      </>
    </ConfirmationDialog>
  );
}

function LogoutDialog(props: { visible: boolean, onDismiss: () => void }) {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const etesync = useCredentials();

  if (!etesync) {
    return null;
  }

  return (
    <ConfirmationDialog
      title="Are you sure?"
      visible={props.visible}
      onOk={async () => {
        const syncManager = SyncManager.getManager(etesync);
        await syncManager.clearDeviceCollections();

        dispatch(logout());
        navigation.closeDrawer();
        navigation.navigate('Auth');
        unregisterSyncTask(etesync.credentials.email);

        persistor.persist();

        props.onDismiss();
      }}
      onCancel={props.onDismiss}
    >
      <Paragraph>
        Are you sure you would like to log out?
      </Paragraph>
      <Paragraph>
        Logging out will remove your account and all of its data from your device, and unsynced changes WILL be lost.
      </Paragraph>
    </ConfirmationDialog>
  );
}

function Drawer() {
  const [showFingerprint, setShowFingerprint] = React.useState(false);
  const [showLogout, setShowLogout] = React.useState(false);
  const navigation = useNavigation();
  const etesync = useCredentials();
  const syncCount = useSelector((state: StoreState) => state.syncCount);

  return (
    <>
      <SafeAreaView style={{ backgroundColor: '#424242' }}>
        <Container style={{ backgroundColor: 'transparent' }}>
          <Image
            style={{ width: 48, height: 48, marginBottom: 15 }}
            source={require('./images/icon.png')}
          />
          <Subheading style={{ color: 'white' }}>{C.appName}</Subheading>
          {etesync &&
            <Text style={{ color: 'white' }}>{etesync.credentials.email}</Text>
          }
        </Container>
      </SafeAreaView>
      <ScrollView style={{ flex: 1 }}>
        <>
          {menuItems.map((menuItem) => (
            <List.Item
              key={menuItem.title}
              title={menuItem.title}
              onPress={() => {
                navigation.closeDrawer();
                navigation.navigate(menuItem.path);
              }}
              left={(props) => <List.Icon {...props} icon={menuItem.icon} />}
            />
          ))}
          {etesync &&
            <>
              <List.Item
                title="Show Fingerprint"
                onPress={() => {
                  setShowFingerprint(true);
                }}
                left={(props) => <List.Icon {...props} icon="fingerprint" />}
              />
              <List.Item
                title="Logout"
                onPress={() => setShowLogout(true)}
                disabled={syncCount > 0}
                left={(props) => <List.Icon {...props} icon="exit-to-app" />}
              />
            </>
          }
        </>
        <Divider />
        <List.Section title="External links">
          {externalMenuItems.map((menuItem) => (
            <List.Item
              key={menuItem.title}
              title={menuItem.title}
              onPress={() => { Linking.openURL(menuItem.link) }}
              left={(props) => <List.Icon {...props} icon={menuItem.icon} />}
            />
          ))}
        </List.Section>
      </ScrollView>

      <FingerprintDialog visible={showFingerprint} onDismiss={() => setShowFingerprint(false)} />
      <LogoutDialog visible={showLogout} onDismiss={() => setShowLogout(false)} />
    </>
  );
}

export default Drawer;

