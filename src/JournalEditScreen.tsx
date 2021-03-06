import * as React from 'react';
import { useSelector } from 'react-redux';
import { NavigationScreenComponent } from 'react-navigation';
import { useNavigation } from './navigation/Hooks';
import { TextInput as NativeTextInput } from 'react-native';
import { Text, TextInput, HelperText, Button, Appbar, Paragraph } from 'react-native-paper';

import { SyncManager } from './sync/SyncManager';
import { useSyncGate } from './SyncGate';
import { useCredentials } from './login';
import { store, StoreState } from './store';
import { addJournal, updateJournal, deleteJournal, performSync } from './store/actions';

import ScrollView from './widgets/ScrollView';
import Container from './widgets/Container';
import ConfirmationDialog from './widgets/ConfirmationDialog';
import ErrorOrLoadingDialog from './widgets/ErrorOrLoadingDialog';

import * as EteSync from 'etesync';
import { useLoading, colorHtmlToInt, colorIntToHtml, defaultColor } from './helpers';

import ColorPicker from './widgets/ColorPicker';

interface FormErrors {
  displayName?: string;
  color?: string;
}

const JournalEditScreen: NavigationScreenComponent = function _JournalEditScreen() {
  const [errors, setErrors] = React.useState({} as FormErrors);
  const [journalType, setJournalType] = React.useState<string>();
  const [displayName, setDisplayName] = React.useState<string>('');
  const [description, setDescription] = React.useState<string>('');
  const [color, setColor] = React.useState<string>('');
  const journals = useSelector((state: StoreState) => state.cache.journals);
  const userInfo = useSelector((state: StoreState) => state.cache.userInfo);
  const syncInfoCollections = useSelector((state: StoreState) => state.cache.syncInfoCollection);
  const syncGate = useSyncGate();
  const navigation = useNavigation();
  const etesync = useCredentials()!;
  const [loading, error, setPromise] = useLoading();

  const journalUid: string = navigation.getParam('journalUid') ?? '';
  React.useMemo(() => {
    if (syncGate) {
      return;
    }

    const passedCollection = syncInfoCollections.get(journalUid);
    if (passedCollection) {
      setJournalType(passedCollection.type);
      setDisplayName(passedCollection.displayName);
      setDescription(passedCollection.description);
      if (passedCollection.color !== undefined) {
        setColor(colorIntToHtml(passedCollection.color));
      }
    } else {
      setJournalType(navigation.getParam('journalType'));
    }

  }, [syncGate, syncInfoCollections, journalUid]);

  if (syncGate) {
    return syncGate;
  }

  if (!journalType) {
    return <React.Fragment />;
  }

  function onSave() {
    setPromise(async () => {
      const saveErrors: FormErrors = {};
      const fieldRequired = 'This field is required!';

      if (!displayName) {
        saveErrors.displayName = fieldRequired;
      }

      if (color && !colorHtmlToInt(color)) {
        saveErrors.color = 'Must be of the form #RRGGBB or #RRGGBBAA or empty';
      }

      if (Object.keys(saveErrors).length > 0) {
        setErrors(saveErrors);
        return;
      }

      const passedCollection = syncInfoCollections.get(journalUid);
      const uid = passedCollection?.uid ?? EteSync.genUid();

      const computedColor = (color) ? colorHtmlToInt(color) : undefined;

      const info = new EteSync.CollectionInfo({ ...passedCollection, uid, type: journalType, displayName, description, color: computedColor });
      const journal = new EteSync.Journal((journals.has(journalUid)) ? journals.get(journalUid)!.serialize() : { uid: info.uid });
      const keyPair = userInfo.getKeyPair(userInfo.getCryptoManager(etesync.encryptionKey));
      const cryptoManager = journal.getCryptoManager(etesync.encryptionKey, keyPair);
      journal.setInfo(cryptoManager, info);

      if (journalUid) {
        await store.dispatch(updateJournal(etesync, journal));
      } else {
        await store.dispatch(addJournal(etesync, journal));
      }

      // FIXME having the sync manager here is ugly. We should just deal with these changes centrally.
      const syncManager = SyncManager.getManager(etesync);
      store.dispatch(performSync(syncManager.sync()));
      navigation.goBack();
    });
  }

  const descriptionRef = React.createRef<NativeTextInput>();

  let collectionColorBox: React.ReactNode;
  switch (journalType) {
    case 'CALENDAR':
    case 'TASKS':
      collectionColorBox = (
        <>
          <ColorPicker
            error={!!errors.color}
            defaultColor={defaultColor}
            color={color}
            onChange={setColor}
          />
          <HelperText
            type="error"
            visible={!!errors.color}
          >
            {errors.color}
          </HelperText>
        </>
      );
      break;
  }

  return (
    <ScrollView keyboardAware>
      <Container>
        <ErrorOrLoadingDialog
          loading={loading}
          error={error}
          onDismiss={() => setPromise(undefined)}
        />
        <TextInput
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => descriptionRef.current!.focus()}
          error={!!errors.displayName}
          onChangeText={setDisplayName}
          label="Display name (title)"
          value={displayName}
        />
        <HelperText
          type="error"
          visible={!!errors.displayName}
        >
          {errors.displayName}
        </HelperText>

        <TextInput
          ref={descriptionRef}
          onChangeText={setDescription}
          label="Description (optional)"
          value={description}
        />
        <HelperText
          type="error"
          visible={false}
        />

        {collectionColorBox}

        <Button
          mode="contained"
          disabled={loading}
          onPress={onSave}
        >
          <Text>{loading ? 'Loading…' : 'Save'}</Text>
        </Button>
      </Container>
    </ScrollView>
  );
};

function RightAction() {
  const [confirmationVisible, setConfirmationVisible] = React.useState(false);
  const navigation = useNavigation();
  const etesync = useCredentials()!;
  const journals = useSelector((state: StoreState) => state.cache.journals);

  const journalUid = navigation.getParam('journalUid');
  const journal = journals.get(journalUid)!;

  return (
    <React.Fragment>
      <Appbar.Action
        icon="delete"
        onPress={() => {
          setConfirmationVisible(true);
        }}
      />
      <ConfirmationDialog
        title="Are you sure?"
        visible={confirmationVisible}
        onOk={async () => {
          await store.dispatch(deleteJournal(etesync, journal));
          navigation.navigate('home');
          // FIXME having the sync manager here is ugly. We should just deal with these changes centrally.
          const syncManager = SyncManager.getManager(etesync);
          store.dispatch(performSync(syncManager.sync()));
        }}
        onCancel={() => {
          setConfirmationVisible(false);
        }}
      >
        <Paragraph>This colection and all of its data will be removed from the server.</Paragraph>
      </ConfirmationDialog>
    </React.Fragment>
  );
}

JournalEditScreen.navigationOptions = ({ navigation }) => {
  const journalUid = navigation.getParam('journalUid');

  return {
    title: (journalUid) ? 'Edit Collection' : 'Create Collection',
    rightAction: (journalUid) ? (
      <RightAction />
    ) : undefined,
  };
};

export default JournalEditScreen;
