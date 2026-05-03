import { useState } from 'react';
import { View, TextInput, Button, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { useApp } from '@/store';
import { saveNote } from '@/db/repositories';

export default function NoteEditor({ route }) {
  const { id } = route.params;
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');

  const { saveNote } = useApp();

  const handleSave = async () => {
    await saveNote(id, { title, content });
    // Redirect to home after saving
    // Link href="/(tabs)/home" would work if using expo-router
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Title"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.input}
        placeholder="Content"
        value={content}
        onChangeText={setContent}
        multiline
      />
      <Button title="Save" onPress={handleSave} />
      <Link href="/(tabs)/home" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
  },
});