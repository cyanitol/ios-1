import * as EteSync from '../api/EteSync';
import * as ICAL from 'ical.js';
import { Calendar } from 'expo';

import { SyncInfo, SyncInfoJournal } from '../SyncGate';
import { store, SyncStateEntryData } from '../store';
import { unsetSyncStateJournal, unsetSyncStateEntry } from '../store/actions';

import { eventVobjectToNative, entryNativeHashCalc } from './helpers';
import { colorIntToHtml } from '../helpers';
import { EventType } from '../pim-types';

import { SyncManager } from './SyncManager';

const ACCOUNT_NAME = 'etesync';

export class SyncManagerCalendar extends SyncManager {
  protected collectionType = 'CALENDAR';
  private localSource;

  public async init() {
    this.localSource = (await Calendar.getSourcesAsync()).find((source) => (source.name === ACCOUNT_NAME));
  }

  protected async syncPush(syncInfo: SyncInfo) {
    const syncStateJournals = this.syncStateJournals;
    const syncStateEntriesReverse = this.syncStateEntries.mapEntries((_entry) => {
      const entry = _entry[1];
      return [entry.localId, entry];
    }).asMutable();
    const now = new Date();
    const eventsRangeStart = new Date(new Date().setFullYear(now.getFullYear() - 5));
    const eventsRangeEnd = new Date(new Date().setFullYear(now.getFullYear() + 5));

    for (const syncJournal of syncInfo.values()) {
      if (syncJournal.collection.type !== this.collectionType) {
        continue;
      }

      const collection = syncJournal.collection;
      const uid = collection.uid;

      const syncStateJournal = syncStateJournals.get(uid);
      const localId = syncStateJournal.localId;
      const existingEvents = await Calendar.getEventsAsync([localId], eventsRangeStart, eventsRangeEnd);
      existingEvents.forEach((_event) => {
        const syncStateEntry = syncStateEntriesReverse.get(_event.id);
        syncStateEntriesReverse.delete(_event.id);

        if (syncStateEntry === undefined) {
          // New
        } else {
          const event = { ..._event, uid: syncStateEntry.uid };
          const currentHash = entryNativeHashCalc(event);
          if (currentHash !== syncStateEntry.lastHash) {
            // Changed
            console.log(`Event changed: ${currentHash} vs ${syncStateEntry.lastHash}`);
          }
        }
      });
    }
  }

  protected async processSyncEntry(containerLocalId: string, syncEntry: EteSync.SyncEntry, syncStateEntries: SyncStateEntryData) {
    const event = EventType.fromVCalendar(new ICAL.Component(ICAL.parse(syncEntry.content)));
    const nativeEvent = eventVobjectToNative(event);
    let syncStateEntry = syncStateEntries.get(event.uid);
    switch (syncEntry.action) {
      case EteSync.SyncEntryAction.Add:
      case EteSync.SyncEntryAction.Change:
        let existingEvent: Calendar.Event;
        try {
          existingEvent = await Calendar.getEventAsync(syncStateEntry.localId);
        } catch (e) {
          // Skip
        }
        if (syncStateEntry && existingEvent) {
          await Calendar.updateEventAsync(syncStateEntry.localId, nativeEvent);
        } else {
          const localEntryId = await Calendar.createEventAsync(containerLocalId, nativeEvent);
          syncStateEntry = {
            uid: nativeEvent.uid,
            localId: localEntryId,
            lastHash: '',
          };
        }

        const createdEvent = { ...await Calendar.getEventAsync(syncStateEntry.localId), uid: nativeEvent.uid };
        syncStateEntry.lastHash = entryNativeHashCalc(createdEvent);

        break;
      case EteSync.SyncEntryAction.Delete:
        if (syncStateEntry) {
          // FIXME: Shouldn't have this if, it should just work
          await Calendar.deleteEventAsync(syncStateEntry.localId);
        }
        break;
    }

    return syncStateEntry;
  }

  protected async createJournal(syncJournal: SyncInfoJournal): Promise<string> {
    const localSource = this.localSource;
    const collection = syncJournal.collection;

    return Calendar.createCalendarAsync({
      sourceId: localSource.id,
      entityType: Calendar.EntityTypes.EVENT,
      title: collection.displayName,
      color: colorIntToHtml(collection.color),
    });
  }

  protected async updateJournal(containerLocalId: string, syncJournal: SyncInfoJournal) {
    const localSource = this.localSource;
    const collection = syncJournal.collection;

    return Calendar.updateCalendarAsync(containerLocalId, {
      sourceId: localSource.id,
      title: collection.displayName,
      color: colorIntToHtml(collection.color),
    });
  }

  protected async deleteJournal(containerLocalId: string) {
    return Calendar.deleteCalendarAsync(containerLocalId);
  }

  protected async debugReset(syncInfo: SyncInfo) {
    const etesync = this.etesync;
    const localSource = this.localSource;
    const syncStateJournals = this.syncStateJournals.asMutable();
    const syncStateEntries = this.syncStateEntries.asMutable();

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    for (const calendar of calendars) {
      if (calendar.source.id === localSource.id) {
        console.log(`Deleting ${calendar.title}`);
        await Calendar.deleteCalendarAsync(calendar.id);
      }
    }

    syncStateJournals.forEach((journal) => {
      store.dispatch(unsetSyncStateJournal(etesync, journal));
      syncStateJournals.delete(journal.uid);
      return true;
    });

    syncStateEntries.forEach((entry) => {
      store.dispatch(unsetSyncStateEntry(etesync, entry));
      syncStateEntries.delete(entry.uid);
      return true;
    });

    this.syncStateJournals = syncStateJournals.asImmutable();
    this.syncStateEntries = syncStateEntries.asImmutable();
  }
}
